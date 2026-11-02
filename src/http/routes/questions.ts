import { Hono } from "hono";
import * as questionService from "../../core/question-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/", async (c) => {
  const { status, assigned_to, created_by } = c.req.query();
  const questions = await questionService.listQuestions(c.get("repo"), {
    status,
    assigned_to,
    created_by,
  });
  return c.json(questions);
});

app.get("/:id", async (c) => {
  try {
    const question = await questionService.getAnswer(c.get("repo"), c.req.param("id"));
    return c.json(question);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const question = await questionService.createQuestion(c.get("repo"), body, "boss");
    return c.json(question, 201);
  } catch (err: any) {
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    return c.json({ error: err.message }, 500);
  }
});

app.put("/:id/answer", async (c) => {
  try {
    const body = await c.req.json();
    const question = await questionService.answerQuestion(
      c.get("repo"),
      c.req.param("id"),
      body.answer,
      "boss"
    );
    return c.json(question);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
