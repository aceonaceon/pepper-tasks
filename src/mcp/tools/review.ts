import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as reviewService from "../../core/review-service";

export function registerReviewTools(server: McpServer): void {
  server.tool(
    "review_list",
    "查詢待覆核任務",
    {
      agent_id: z.string().optional().describe("篩選特定 Agent 的待覆核任務"),
    },
    async (params) => {
      try {
        const tasks = reviewService.listPendingReviews(params.agent_id);
        return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "review_get",
    "取得覆核結果 + Feedback",
    {
      task_id: z.string().describe("任務 ID"),
    },
    async (params) => {
      try {
        const review = reviewService.getReview(params.task_id);
        return { content: [{ type: "text", text: JSON.stringify(review, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "feedback_history",
    "查詢歷史 Feedback（用於學習老闆偏好）",
    {
      agent_id: z.string().optional().describe("篩選特定 Agent"),
      limit: z.number().optional().describe("回傳筆數上限（預設 20）"),
    },
    async (params) => {
      try {
        const reviews = reviewService.feedbackHistory(params.agent_id, params.limit);
        return { content: [{ type: "text", text: JSON.stringify(reviews, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
