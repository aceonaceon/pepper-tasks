import { Hono } from "hono";
import * as reviewService from "../../core/review-service";
import type { HttpEnv } from "../types";

const app = new Hono<HttpEnv>();

app.get("/", async (c) => {
  const { agent_id } = c.req.query();
  const tasks = await reviewService.listPendingReviews(c.get("repo"), agent_id);
  return c.json(tasks);
});

app.get("/:taskId", async (c) => {
  try {
    const review = await reviewService.getReview(c.get("repo"), c.req.param("taskId"));
    return c.json(review);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const review = await reviewService.submitReview(
      c.get("repo"),
      body.task_id,
      body.approved,
      body.comment || "",
      "boss"
    );
    return c.json(review, 201);
  } catch (err: any) {
    if (err.name === "NotFoundError") return c.json({ error: err.message }, 404);
    return c.json({ error: err.message }, 500);
  }
});

app.get("/feedback", async (c) => {
  const { agent_id, limit } = c.req.query();
  const reviews = await reviewService.feedbackHistory(
    c.get("repo"),
    agent_id,
    limit ? parseInt(limit) : undefined
  );
  return c.json(reviews);
});

export default app;
