import { Hono } from "hono";
import * as taskService from "../../core/task-service";

const app = new Hono();

app.get("/", (c) => {
  const { status, assigned_to, created_by, quadrant, search } = c.req.query();
  const tasks = taskService.listTasks({ status, assigned_to, created_by, quadrant, search });
  return c.json(tasks);
});

app.get("/:id", (c) => {
  try {
    const result = taskService.getTask(c.req.param("id"));
    return c.json(result);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const task = taskService.createTask(body, "boss");
    return c.json(task, 201);
  } catch (err: any) {
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    return c.json({ error: err.message }, 500);
  }
});

app.put("/:id", async (c) => {
  try {
    const body = await c.req.json();
    const task = taskService.updateTask(c.req.param("id"), body, "boss");
    return c.json(task);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    if (err.name === "PermissionError") return c.json({ error: err.message }, 403);
    return c.json({ error: err.message }, 500);
  }
});

app.delete("/:id", (c) => {
  try {
    taskService.deleteTask(c.req.param("id"), "boss");
    return c.json({ ok: true });
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
