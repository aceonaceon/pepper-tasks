import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as taskService from "../../core/task-service";

export function registerTaskTools(server: McpServer): void {
  server.tool(
    "task_create",
    "建立新任務",
    {
      title: z.string().describe("任務標題"),
      description: z.string().optional().describe("詳細描述"),
      assigned_to: z.string().describe("負責者（boss / agent:{name}）"),
      quadrant: z
        .enum([
          "urgent_important",
          "not_urgent_important",
          "urgent_not_important",
          "not_urgent_not_important",
        ])
        .optional()
        .describe("艾森豪象限"),
      task_type: z
        .enum(["ephemeral", "tracking", "project"])
        .optional()
        .describe("任務生命週期：ephemeral=一次性（完成後 48h 自動歸檔）、tracking=持續追蹤（預設）、project=長期專案"),
      deadline: z.string().optional().describe("截止時間 (ISO 8601)"),
      parent_task_id: z.string().optional().describe("父任務 ID"),
      caller: z.string().describe("呼叫者身份（boss / agent:{name}）"),
    },
    async (params) => {
      try {
        const task = taskService.createTask(
          {
            title: params.title,
            description: params.description,
            assigned_to: params.assigned_to,
            quadrant: params.quadrant,
            task_type: params.task_type,
            deadline: params.deadline,
            parent_task_id: params.parent_task_id,
          },
          params.caller
        );
        return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "task_update",
    "更新任務（受權限控制）",
    {
      task_id: z.string().describe("任務 ID"),
      status: z
        .enum(["pending", "in_progress", "blocked", "review", "completed", "archived"])
        .optional()
        .describe("新狀態。blocked 僅限「Agent 因缺少老闆決策而無法繼續」的情況，必須同時建立 question_create 提問。等待外部回覆、行程提醒、已完成待確認等場景不應使用 blocked。"),
      title: z.string().optional().describe("新標題"),
      description: z.string().optional().describe("新描述"),
      quadrant: z
        .enum([
          "urgent_important",
          "not_urgent_important",
          "urgent_not_important",
          "not_urgent_not_important",
        ])
        .optional()
        .describe("新象限"),
      deadline: z.string().nullable().optional().describe("新截止時間"),
      assigned_to: z.string().optional().describe("新負責者"),
      caller: z.string().describe("呼叫者身份"),
    },
    async (params) => {
      try {
        const { task_id, caller, ...updates } = params;
        const task = taskService.updateTask(task_id, updates, caller);
        return { content: [{ type: "text", text: JSON.stringify(task, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "task_list",
    "查詢任務列表（支援關鍵字搜尋，建議建立任務前先查重）",
    {
      status: z.string().optional().describe("篩選狀態"),
      assigned_to: z.string().optional().describe("篩選負責者"),
      created_by: z.string().optional().describe("篩選建立者"),
      quadrant: z.string().optional().describe("篩選象限"),
      search: z.string().optional().describe("關鍵字搜尋（模糊比對 title 和 description，用於建立任務前查重）"),
    },
    async (params) => {
      try {
        const tasks = taskService.listTasks(params);
        return { content: [{ type: "text", text: JSON.stringify(tasks, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "task_get",
    "取得單一任務詳情 + 時間軸",
    {
      task_id: z.string().describe("任務 ID"),
    },
    async (params) => {
      try {
        const result = taskService.getTask(params.task_id);
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
