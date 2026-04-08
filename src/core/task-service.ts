import { getDb } from "../db/connection";
import * as queries from "../db/queries";
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

export function createTask(params: CreateTaskParams, caller: string): Task {
  const now = new Date().toISOString();
  const task: Task = {
    id: generateUUID(),
    title: params.title,
    description: params.description || "",
    created_by: caller,
    assigned_to: params.assigned_to,
    status: "pending",
    quadrant: params.quadrant || "not_urgent_not_important",
    deadline: params.deadline || null,
    parent_task_id: params.parent_task_id || null,
    created_at: now,
    updated_at: now,
  };

  const db = getDb();
  const tx = db.transaction(() => {
    queries.insertTask(task);
    audit.log(task.id, caller, "created", null, task);
  });
  tx();

  return task;
}

export function updateTask(
  taskId: string,
  updates: UpdateTaskParams,
  caller: string
): Task {
  const task = queries.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  assertCanUpdate(task, caller, updates);

  if (updates.status) {
    validateStatusTransition(task.status, updates.status);
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

  const db = getDb();
  const tx = db.transaction(() => {
    queries.updateTask(taskId, updateFields);

    if (updates.status && updates.status !== task.status) {
      audit.log(taskId, caller, "status_changed", task.status, updates.status);
    }

    const changedFields = Object.keys(updateFields).filter((k) => k !== "status");
    if (changedFields.length > 0) {
      const oldValues: Record<string, unknown> = {};
      const newValues: Record<string, unknown> = {};
      for (const key of changedFields) {
        oldValues[key] = (task as Record<string, unknown>)[key];
        newValues[key] = updateFields[key];
      }
      audit.log(taskId, caller, "updated", oldValues, newValues);
    }
  });
  tx();

  return queries.getTaskById(taskId)!;
}

export function getTask(taskId: string) {
  const task = queries.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  const subTasks = queries.getSubTasks(taskId);
  const questions = queries.listQuestions({ task_id: taskId });
  const reviews = queries.getReviewsByTaskId(taskId);
  const auditLogs = queries.getAuditLogsByTaskId(taskId);

  return { task, subTasks, questions, reviews, auditLogs };
}

export function listTasks(filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  quadrant?: string;
}) {
  return queries.listTasks(filters);
}

export function deleteTask(taskId: string, caller: string): void {
  const task = queries.getTaskById(taskId);
  if (!task) throw new NotFoundError("Task", taskId);

  if (task.created_by === "boss" && caller !== "boss") {
    throw new PermissionError("Agent cannot delete boss-created tasks");
  }
  if (task.created_by !== caller && caller !== "boss") {
    throw new PermissionError("Cannot delete tasks created by another agent");
  }

  const db = getDb();
  const tx = db.transaction(() => {
    queries.deleteTask(taskId);
    audit.log(taskId, caller, "deleted", task, null);
  });
  tx();
}

function assertCanUpdate(
  task: Task,
  caller: string,
  updates: UpdateTaskParams
): void {
  if (caller === "boss") return;

  if (task.created_by === "boss") {
    const allowedFields = new Set(["status", "title", "description"]);
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
