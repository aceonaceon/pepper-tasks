import { Hono } from "hono";
import * as dashboardService from "../../core/dashboard-service";

const app = new Hono();

app.get("/", (c) => {
  const { agent_id } = c.req.query();
  const data = dashboardService.getDashboard(agent_id);
  return c.json(data);
});

export default app;
