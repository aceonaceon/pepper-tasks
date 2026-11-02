import type { TaskRepository } from "../db/repository";
import { generateUUID } from "../shared/uuid";

export async function log(
  repo: TaskRepository,
  taskId: string | null,
  actor: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown
): Promise<void> {
  await repo.insertAuditLog({
    id: generateUUID(),
    task_id: taskId,
    actor,
    action,
    old_value: oldValue !== undefined ? JSON.stringify(oldValue) : null,
    new_value: newValue !== undefined ? JSON.stringify(newValue) : null,
    timestamp: new Date().toISOString(),
  });
}

export function getLog(repo: TaskRepository, taskId: string) {
  return repo.getAuditLogsByTaskId(taskId);
}
