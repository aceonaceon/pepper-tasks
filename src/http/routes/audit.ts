import { Hono } from "hono";
import * as audit from "../../core/audit-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/:taskId", async (c) => {
  const logs = await audit.getLog(c.get("repo"), c.req.param("taskId"));
  return c.json(logs);
});

export default app;
