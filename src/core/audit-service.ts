import * as queries from "../db/queries";
import { generateUUID } from "../shared/uuid";

export function log(
  taskId: string | null,
  actor: string,
  action: string,
  oldValue?: unknown,
  newValue?: unknown
): void {
  queries.insertAuditLog({
    id: generateUUID(),
    task_id: taskId,
    actor,
    action,
    old_value: oldValue !== undefined ? JSON.stringify(oldValue) : null,
    new_value: newValue !== undefined ? JSON.stringify(newValue) : null,
    timestamp: new Date().toISOString(),
  });
}

export function getLog(taskId: string) {
  return queries.getAuditLogsByTaskId(taskId);
}
