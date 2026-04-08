import { Hono } from "hono";
import * as audit from "../../core/audit-service";

const app = new Hono();

app.get("/:taskId", (c) => {
  const logs = audit.getLog(c.req.param("taskId"));
  return c.json(logs);
});

export default app;
