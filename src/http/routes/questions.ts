import { Hono } from "hono";
import * as questionService from "../../core/question-service";

const app = new Hono();

app.get("/", (c) => {
  const { status, assigned_to, created_by } = c.req.query();
  const questions = questionService.listQuestions({ status, assigned_to, created_by });
  return c.json(questions);
});

app.get("/:id", (c) => {
  try {
    const question = questionService.getAnswer(c.req.param("id"));
    return c.json(question);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const question = questionService.createQuestion(body, "boss");
    return c.json(question, 201);
  } catch (err: any) {
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    return c.json({ error: err.message }, 500);
  }
});

app.put("/:id/answer", async (c) => {
  try {
    const body = await c.req.json();
    const question = questionService.answerQuestion(
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
