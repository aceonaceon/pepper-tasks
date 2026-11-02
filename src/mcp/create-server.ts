import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskRepository } from "../db/repository";
import { registerTaskTools } from "./tools/task";
import { registerQuestionTools } from "./tools/question";
import { registerReviewTools } from "./tools/review";
import { registerSystemTools } from "./tools/system";

export function createMcpServer(repo: TaskRepository): McpServer {
  const server = new McpServer({
    name: "pepper-tasks",
    version: "0.1.0",
  });

  registerTaskTools(server, repo);
  registerQuestionTools(server, repo);
  registerReviewTools(server, repo);
  registerSystemTools(server, repo);

  return server;
}
