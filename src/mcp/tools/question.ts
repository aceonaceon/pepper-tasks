import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as questionService from "../../core/question-service";

export function registerQuestionTools(server: McpServer): void {
  server.tool(
    "question_create",
    "建立結構化問題，等待老闆回答",
    {
      task_id: z.string().optional().describe("關聯任務 ID"),
      question_type: z
        .enum(["yes_no", "single_choice", "multi_choice", "datetime", "open_ended"])
        .describe("問題類型"),
      question_text: z.string().describe("問題內容"),
      options: z.array(z.string()).optional().describe("選項列表（僅 choice 類型需要）"),
      assigned_to: z.string().describe("回答者（通常是 boss）"),
      caller: z.string().describe("提問者身份"),
    },
    async (params) => {
      try {
        const question = questionService.createQuestion(
          {
            task_id: params.task_id,
            question_type: params.question_type,
            question_text: params.question_text,
            options: params.options,
            assigned_to: params.assigned_to,
          },
          params.caller
        );
        return { content: [{ type: "text", text: JSON.stringify(question, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "question_list",
    "查詢問題列表",
    {
      status: z.string().optional().describe("篩選狀態 (pending / answered)"),
      assigned_to: z.string().optional().describe("篩選回答者"),
      created_by: z.string().optional().describe("篩選提問者"),
    },
    async (params) => {
      try {
        const questions = questionService.listQuestions(params);
        return { content: [{ type: "text", text: JSON.stringify(questions, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "question_get_answer",
    "取得問題的回答",
    {
      question_id: z.string().describe("問題 ID"),
    },
    async (params) => {
      try {
        const question = questionService.getAnswer(params.question_id);
        return { content: [{ type: "text", text: JSON.stringify(question, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
