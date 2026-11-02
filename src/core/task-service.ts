import type { TaskRepository } from "../db/repository";
import * as audit from "./audit-service";
import { generateUUID } from "../shared/uuid";
import {
  PermissionError,
  NotFoundError,
  ValidationError,
} from "../shared/errors";
import type {
  Task,
  CreateTaskParams,
  UpdateTaskParams,
  TaskStatus,
} from "../shared/types";
import { VALID_TRANSITIONS } from "../shared/types";

export async function createTask(
  repo: TaskRepository,
  params: CreateTaskParams,
  caller: string
): Promise<Task> {
  const now = new Date().toISOString();
  const task: Task = {
    id: generateUUID(),
    title: params.title,
    description: params.description || "",
    created_by: caller,
    assigned_to: params.assigned_to,
    status: "pending",
    quadrant: params.quadrant || "not_urgent_not_important",
    task_type: params.task_type || "tracking",
    deadline: params.deadline || null,
    parent_task_id: params.parent_task_id || null,
    created_at: now,
    updated_at: now,
  };

  await repo.transaction(async (tx) => {
    await tx.insertTask(task);
    await audit.log(tx, task.id, caller, "created", null, task);
  });

  return task;
}

export async function updateTask(
  repo: TaskRepository,
  taskId: string,
  updates: UpdateTaskParams,
  caller: string
): Promise<Task> {
  const task = await repo.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  assertCanUpdate(task, caller, updates);

  if (updates.status) {
    validateStatusTransition(task.status, updates.status);

    // blocked requires at least one pending question for this task
    if (updates.status === "blocked") {
      const pendingQs = await repo.listQuestions({ task_id: taskId, status: "pending" });
      if (pendingQs.length === 0) {
        throw new ValidationError(
          "Cannot set status to 'blocked' without a pending question. " +
          "Create a question (question_create with task_id) first, then set status to blocked."
        );
      }
    }
  }

  const updateFields: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      updateFields[key] = value;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return task;
  }

  await repo.transaction(async (tx) => {
    await tx.updateTask(taskId, updateFields);

    if (updates.status && updates.status !== task.status) {
      await audit.log(tx, taskId, caller, "status_changed", task.status, updates.status);
      // Auto-acknowledge all answered questions for this task
      // so they disappear from action_items without Agent needing question_get_answer
      await tx.acknowledgeAnsweredQuestions(taskId);
    }

    const changedFields = Object.keys(updateFields).filter((k) => k !== "status");
    if (changedFields.length > 0) {
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const key of changedFields) {
        oldValues[key] = (task as Record<string, unknown>)[key];
        newValues[key] = updateFields[key];
      }
      await audit.log(tx, taskId, caller, "updated", oldValues, newValues);
    }
  });

  return (await repo.getTaskById(taskId))!;
}

export async function getTask(repo: TaskRepository, taskId: string) {
  const task = await repo.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  const subTasks = await repo.getSubTasks(taskId);
  const questions = await repo.listQuestions({ task_id: taskId });
  const reviews = await repo.getReviewsByTaskId(taskId);
  const auditLogs = await repo.getAuditLogsByTaskId(taskId);

  return { task, subTasks, questions, reviews, auditLogs };
}

export function listTasks(repo: TaskRepository, filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  quadrant?: string;
  search?: string;
}) {
  return repo.listTasks(filters);
}

export async function deleteTask(
  repo: TaskRepository,
  taskId: string,
  caller: string
): Promise<void> {
  const task = await repo.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  if (task.created_by === "boss" && caller !== "boss") {
    throw new PermissionError("Agent cannot delete boss-created tasks");
  }
  if (task.created_by !== caller && caller !== "boss") {
    throw new PermissionError("Cannot delete tasks created by another agent");
  }

  await repo.transaction(async (tx) => {
    await tx.deleteTask(taskId);
    await audit.log(tx, taskId, caller, "deleted", task, null);
  });
}

function assertCanUpdate(
  task: Task,
  caller: string,
  updates: UpdateTaskParams
): void {
  if (caller === "boss") return;

  if (task.created_by === "boss" || task.created_by === "system") {
    const allowedFields = new Set(["status", "title", "description", "assigned_to"]);
    for (const key of Object.keys(updates)) {
      if ((updates as Record<string, unknown>)[key] !== undefined && !allowedFields.has(key)) {
        throw new PermissionError(
          `Agent cannot modify '${key}' on boss-created tasks`
        );
      }
    }
  } else if (task.created_by !== caller) {
    throw new PermissionError("Cannot modify tasks created by another agent");
  }
}

function validateStatusTransition(
  current: TaskStatus,
  next: TaskStatus
): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed.includes(next)) {
    throw new ValidationError(
      `Invalid status transition: ${current} → ${next}. Allowed: ${allowed.join(", ") || "none"}`
    );
  }
}
