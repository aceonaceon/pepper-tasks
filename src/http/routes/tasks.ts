import { Hono } from "hono";
import * as taskService from "../../core/task-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/", async (c) => {
  const { status, assigned_to, created_by, quadrant, search } = c.req.query();
  const tasks = await taskService.listTasks(c.get("repo"), {
    status,
    assigned_to,
    created_by,
    quadrant,
    search,
  });
  return c.json(tasks);
});

app.get("/:id", async (c) => {
  try {
    const result = await taskService.getTask(c.get("repo"), c.req.param("id"));
    return c.json(result);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const task = await taskService.createTask(c.get("repo"), body, "boss");
    return c.json(task, 201);
  } catch (err: any) {
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    return c.json({ error: err.message }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const task = await taskService.updateTask(
      c.get("repo"),
      c.req.param("id"),
      body,
      "boss"
    );
    return c.json(task);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    if (err.name === "PermissionError") return c.json({ error: err.message }, 403);
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/:id", async (c) => {
  try {
    await taskService.deleteTask(c.get("repo"), c.req.param("id"), "boss");
    return c.json({ ok: true });
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
