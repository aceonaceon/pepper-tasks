import { Hono } from "hono";
import * as reviewService from "../../core/review-service";

const app = new Hono();

app.get("/", (c) => {
  const { agent_id } = c.req.query();
  const tasks = reviewService.listPendingReviews(agent_id);
  return c.json(tasks);
});

app.get("/:taskId", (c) => {
  try {
    const review = reviewService.getReview(c.req.param("taskId"));
    return c.json(review);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

app.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const review = reviewService.submitReview(
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

app.get("/feedback", (c) => {
  const { agent_id, limit } = c.req.query();
  const reviews = reviewService.feedbackHistory(
    agent_id,
    limit ? parseInt(limit) : undefined
  );
  return c.json(reviews);
});

export default app;
