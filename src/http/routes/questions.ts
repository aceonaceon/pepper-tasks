import { Hono } from "hono";
import * as questionService from "../../core/question-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/", async (c) => {
  const { status, assigned_to, created_by, task_id, question_id } = c.req.query();
  const questions = await questionService.listQuestions(c.get("repo"), {
    status,
    assigned_to,
    created_by,
    task_id,
    question_id,
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
    if (!body || typeof body !== "object" || Array.isArray(body) || !Object.hasOwn(body, "answer")) {
      return c.json({ error: "Answer is required" }, 400);
    }
    const question = await questionService.answerQuestion(
      c.get("repo"),
      c.req.param("id"),
      body.answer,
      "boss"
    );
    return c.json(question);
  } catch (err: any) {
    if (err instanceof SyntaxError) return c.json({ error: "Malformed JSON" }, 400);
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    if (err.name === "ConflictError") return c.json({ error: err.message }, 409);
    return c.json({ error: err.message }, 500);
  }
});
app.post("/:id/retire", async (c) => {
  try {
    const body = await c.req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return c.json({ error: "JSON object required" }, 400);
    }
    const question = await questionService.retireQuestion(c.get("repo"), {
      question_id: c.req.param("id"),
      expected_task_id: body.expected_task_id,
      expected_description: body.expected_description,
      reason: body.reason,
      replacement_question_id: body.replacement_question_id,
      caller: "boss"
    });
    return c.json(question);
  } catch (err: any) {
    if (err instanceof SyntaxError) return c.json({ error: "Malformed JSON" }, 400);
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    if (err.name === "ValidationError") return c.json({ error: err.message }, 400);
    if (err.name === "PermissionError") return c.json({ error: err.message }, 403);
    if (err.name === "ConflictError") return c.json({ error: err.message }, 409);
    return c.json({ error: err.message }, 500);
  }
});

export default app;
