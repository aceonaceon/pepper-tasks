import { Hono } from "hono";
import * as dashboardService from "../../core/dashboard-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/", async (c) => {
  const { agent_id } = c.req.query();
  const data = await dashboardService.getDashboard(c.get("repo"), agent_id);
  return c.json(data);
});

app.get("/lite", async (c) => {
  const { agent_id } = c.req.query();
  const data = await dashboardService.getDashboardLite(c.get("repo"), agent_id);
  return c.json(data);
});

export default app;
