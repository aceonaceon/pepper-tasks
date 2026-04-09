import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as dashboardService from "../../core/dashboard-service";
import * as audit from "../../core/audit-service";

export function registerSystemTools(server: McpServer): void {
  server.tool(
    "dashboard",
    "全貌概覽 — 任務統計、待回覆項目、最緊急任務、孤兒任務（stuck 但沒有 pending question 的任務，需要 Agent 主動推進）",
    {
      agent_id: z.string().optional().describe("篩選特定 Agent"),
    },
    async (params) => {
      try {
        const data = dashboardService.getDashboard(params.agent_id);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );

  server.tool(
    "audit_log",
    "任務歷史變更紀錄",
    {
      task_id: z.string().describe("任務 ID"),
    },
    async (params) => {
      try {
        const logs = audit.getLog(params.task_id);
        return { content: [{ type: "text", text: JSON.stringify(logs, null, 2) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Error: ${err.message}` }], isError: true };
      }
    }
  );
}
