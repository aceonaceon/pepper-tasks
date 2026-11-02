import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getLocalRepository } from "../db/sqlite-repository";
import { createMcpServer } from "./create-server";

export { createMcpServer } from "./create-server";

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer(getLocalRepository());
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Agent Task Board MCP server running (stdio)\n");
}
