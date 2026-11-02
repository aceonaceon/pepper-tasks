import { Hono } from "hono";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "../../mcp/create-server";
import type { TaskRepository } from "../../db/repository";
import type { HttpEnv } from "../types";

type McpHttpSession = {
  transport: WebStandardStreamableHTTPServerTransport;
};

export type McpRouterOptions = {
  stateless?: boolean;
};

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

async function createSessionTransport(
  repo: TaskRepository,
  sessions: Map<string, McpHttpSession>
): Promise<WebStandardStreamableHTTPServerTransport> {
  let transport: WebStandardStreamableHTTPServerTransport;

  transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
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

  const server = createMcpServer(repo);
  await server.connect(transport);

  return transport;
}

export function createMcpRouter(options: McpRouterOptions = {}) {
  const sessions = new Map<string, McpHttpSession>();
  const app = new Hono<HttpEnv>();

  app.all("/", async (c) => {
    const repo = c.get("repo");

    if (options.stateless) {
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      const server = createMcpServer(repo);
      await server.connect(transport);
      return transport.handleRequest(c.req.raw);
    }

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

    const transport = await createSessionTransport(repo, sessions);
    return transport.handleRequest(c.req.raw, { parsedBody });
  });

  return app;
}
