import type { TaskRepository } from "../db/repository";
import * as audit from "./audit-service";
import { generateUUID } from "../shared/uuid";
import { NotFoundError } from "../shared/errors";
import type { Review } from "../shared/types";

export async function submitReview(
  repo: TaskRepository,
  taskId: string,
  approved: boolean,
  comment: string,
  reviewer: string
): Promise<Review> {
  const task = await repo.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);
  const subTasks = approved ? await repo.getSubTasks(taskId) : [];

  const now = new Date().toISOString();
  const review: Review = {
    id: generateUUID(),
    task_id: taskId,
    reviewer,
    approved: approved ? 1 : 0,
    comment: comment || "",
    created_at: now,
  };

  await repo.transaction(async (tx) => {
    await tx.insertReview(review);

    if (approved) {
      await tx.updateTask(taskId, { status: "completed" });
      await audit.log(tx, taskId, reviewer, "reviewed", null, {
        approved: true,
        comment,
      });
      await audit.log(tx, taskId, reviewer, "status_changed", "review", "completed");

      // Auto-archive any orphaned sub-tasks
      for (const sub of subTasks) {
        if (!["completed", "archived"].includes(sub.status)) {
          await tx.updateTask(sub.id, { status: "archived" });
          await audit.log(tx, sub.id, "system", "status_changed", sub.status, "archived");
        }
      }
    } else {
      await tx.updateTask(taskId, { status: "in_progress" });
      await audit.log(tx, taskId, reviewer, "reviewed", null, {
        approved: false,
        comment,
      });
      await audit.log(tx, taskId, reviewer, "status_changed", "review", "in_progress");
      // No auto-created [修正] sub-task — Agent reads the feedback via
      // review_get / feedback_history and decides how to proceed.
    }
  });

  return review;
}

export async function getReview(repo: TaskRepository, taskId: string) {
  const reviews = await repo.getReviewsByTaskId(taskId);
  if (reviews.length === 0) return null;
  return reviews[0]; // latest
}

export function listPendingReviews(repo: TaskRepository, agentId?: string) {
  return repo.getTasksInReview(agentId);
}

export function feedbackHistory(
  repo: TaskRepository,
  agentId?: string,
  limit: number = 20
) {
  return repo.getFeedbackHistory(agentId, limit);
}
