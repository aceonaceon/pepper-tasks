import { randomUUID } from "crypto";
import { Hono } from "hono";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "../../mcp/server";

type McpHttpSession = {
  transport: WebStandardStreamableHTTPServerTransport;
};

const sessions = new Map<string, McpHttpSession>();

const app = new Hono();

function jsonRpcError(status: number, code: number, message: string): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      error: { code, message },
      id: null,
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    }
  );
}

function hasInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((message) => isInitializeRequest(message));
  }
  return isInitializeRequest(body);
}

async function createSessionTransport(): Promise<WebStandardStreamableHTTPServerTransport> {
  let transport: WebStandardStreamableHTTPServerTransport;

  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { transport });
    },
    onsessionclosed: (sessionId) => {
      sessions.delete(sessionId);
    },
  });

  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  const server = createMcpServer();
  await server.connect(transport);

  return transport;
}

app.all("/", async (c) => {
  const sessionId = c.req.raw.headers.get("mcp-session-id");

  if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) {
      return jsonRpcError(404, -32001, "Session not found");
    }
    return session.transport.handleRequest(c.req.raw);
  }

  if (c.req.method !== "POST") {
    return jsonRpcError(
      400,
      -32000,
      "Bad Request: Mcp-Session-Id header is required"
    );
  }

  let parsedBody: unknown;
  try {
    parsedBody = await c.req.json();
  } catch {
    return jsonRpcError(400, -32700, "Parse error: Invalid JSON");
  }

  if (!hasInitializeRequest(parsedBody)) {
    return jsonRpcError(400, -32000, "Bad Request: initialize request is required");
  }

  const transport = await createSessionTransport();
  return transport.handleRequest(c.req.raw, { parsedBody });
});

export default app;
