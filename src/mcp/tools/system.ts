import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as dashboardService from "../../core/dashboard-service";
import * as audit from "../../core/audit-service";

export function registerSystemTools(server: McpServer): void {
  server.tool(
    "dashboard",
    "全貌概覽 + 行動清單。回傳 action_items 已按優先級排序（1=已回覆問題 2=被退回任務 3=孤兒任務 4=進行中 5=待處理），Agent 每次 session 開始呼叫一次，從頭到尾依序處理 action_items 即可。",
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
    "dashboard_lite",
    "輕量行動清單（≤24h 新事件）。適合 session 中段 heartbeat，不會載入完整歷史。session 開始請用 dashboard()。",
    {
      agent_id: z.string().optional().describe("篩選特定 Agent"),
    },
    async (params) => {
      try {
        const data = dashboardService.getDashboardLite(params.agent_id);
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
