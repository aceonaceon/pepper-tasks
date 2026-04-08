import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTaskTools } from "./tools/task";
import { registerQuestionTools } from "./tools/question";
import { registerReviewTools } from "./tools/review";
import { registerSystemTools } from "./tools/system";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "pepper-tasks",
    version: "0.1.0",
  });

  registerTaskTools(server);
  registerQuestionTools(server);
  registerReviewTools(server);
  registerSystemTools(server);

  return server;
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Agent Task Board MCP server running (stdio)\n");
}
