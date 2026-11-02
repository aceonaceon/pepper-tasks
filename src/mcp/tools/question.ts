import { registerLegacyTool, registerStrictTool } from "../registration";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskRepository } from "../../db/repository";
import type { RetireQuestionParams } from "../../shared/types";
import * as questionService from "../../core/question-service";

export function registerQuestionTools(server: McpServer, repo: TaskRepository): void {
  registerLegacyTool(server,
    "question_create",
    "建立結構化問題，等待老闆回答。必須先建立任務再提問，這樣老闆回答後系統才能自動解除任務的 blocked 狀態。",
    {
      task_id: z.string().describe("關聯任務 ID（必填 — 先用 task_create 建立任務，再用此工具提問）"),
      question_type: z.enum(["yes_no", "single_choice", "multi_choice", "datetime", "open_ended"]).describe("問題類型"),
      question_text: z.string().describe("問題內容"),
      description: z.string().optional().describe("問題的詳細說明、背景資訊、研究結果（支援 Markdown）"),
      options: z.array(z.string()).optional().describe("選項列表（僅 choice 類型需要）"),
      assigned_to: z.string().describe("回答者（通常是 boss）"),
      caller: z.string().describe("提問者身份"),
    },
    async (params) => {
      try {
        const question = await questionService.createQuestion(
          repo,
          {
            task_id: params.task_id,
            question_type: params.question_type,
            question_text: params.question_text,
            description: params.description,
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
  registerLegacyTool(server,
    "question_list",
    "查詢問題列表",
    {
      status: z.string().optional().describe("篩選狀態 (pending / answered / acknowledged / obsolete)"),
      assigned_to: z.string().optional().describe("篩選回答者"),
      created_by: z.string().optional().describe("篩選提問者"),
      task_id: z.string().optional().describe("精確篩選任務 ID"),
      question_id: z.string().optional().describe("精確篩選問題 ID"),
    },
    async (params) => {
      try {
        const questions = await questionService.listQuestions(repo, params);
        return { content: [{ type: "text", text: JSON.stringify(questions, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
  const retirementSchema: z.ZodType<RetireQuestionParams> = z.strictObject({
    question_id: z.string().describe("要退休的問題 ID"),
    expected_task_id: z.string().describe("先前觀察到的精確任務 ID"),
    expected_description: z.string().nullable().describe("先前觀察到的完整描述，或 null"),
    reason: z.string().describe("退休原因，1 至 1000 字元"),
    caller: z.string().describe("操作者身份，必須為建立者或 boss"),
    replacement_question_id: z.string().optional().describe("同任務、建立者、回答者的待回答替代問題 ID"),
  });
  registerStrictTool(server,
    "question_retire",
    {
      description: "將待回答問題標記為過時，保留原文與稽核紀錄。重試相同請求安全且不重複記錄。",
      inputSchema: retirementSchema,
    },
    async (params) => {
      try {
        const question = await questionService.retireQuestion(repo, params);
        return { content: [{ type: "text", text: JSON.stringify(question, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
  registerLegacyTool(server,
    "question_get_answer",
    "取得問題的回答",
    {
      question_id: z.string().describe("問題 ID"),
    },
    async (params) => {
      try {
        const question = await questionService.getAnswer(repo, params.question_id);
        return { content: [{ type: "text", text: JSON.stringify(question, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
