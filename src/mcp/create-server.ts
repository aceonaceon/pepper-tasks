import { BUILD_VERSION } from "../shared/version";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskRepository } from "../db/repository";
import { registerTaskTools } from "./tools/task";
import { registerQuestionTools } from "./tools/question";
import { registerReviewTools } from "./tools/review";
import { registerSystemTools } from "./tools/system";

export function createMcpServer(repo: TaskRepository): McpServer {
  const server = new McpServer({
    name: "pepper-tasks",
    version: BUILD_VERSION,
  });

  registerTaskTools(server, repo);
  registerQuestionTools(server, repo);
  registerReviewTools(server, repo);
  registerSystemTools(server, repo);

  return server;
}
