import { getDb } from "../db/connection";
import * as queries from "../db/queries";
import * as audit from "./audit-service";
import * as taskService from "./task-service";
import { generateUUID } from "../shared/uuid";
import { NotFoundError } from "../shared/errors";
import type { Review } from "../shared/types";

export function submitReview(
  taskId: string,
  approved: boolean,
  comment: string,
  reviewer: string
): Review {
  const task = queries.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  const now = new Date().toISOString();
  const review: Review = {
    id: generateUUID(),
    task_id: taskId,
    reviewer,
    approved: approved ? 1 : 0,
    comment: comment || "",
    created_at: now,
  };

  const db = getDb();
  const tx = db.transaction(() => {
    queries.insertReview(review);

    if (approved) {
      queries.updateTask(taskId, { status: "completed" });
      audit.log(taskId, reviewer, "reviewed", null, {
        approved: true,
        comment,
      });
      audit.log(taskId, reviewer, "status_changed", "review", "completed");
    } else {
      queries.updateTask(taskId, { status: "in_progress" });
      audit.log(taskId, reviewer, "reviewed", null, {
        approved: false,
        comment,
      });
      audit.log(taskId, reviewer, "status_changed", "review", "in_progress");

      // Create a revision sub-task with the feedback
      taskService.createTask(
        {
          title: `[修正] ${task.title}`,
          description: `Feedback: ${comment}`,
          assigned_to: task.assigned_to,
          quadrant: task.quadrant,
          parent_task_id: taskId,
        },
        "system"
      );
    }
  });
  tx();

  return review;
}

export function getReview(taskId: string) {
  const reviews = queries.getReviewsByTaskId(taskId);
  if (reviews.length === 0) return null;
  return reviews[0]; // latest
}

export function listPendingReviews(agentId?: string) {
  return queries.getTasksInReview(agentId);
}

export function feedbackHistory(agentId?: string, limit: number = 20) {
  return queries.getFeedbackHistory(agentId, limit);
}
