import { getDb } from "./connection";
import type {
  Task,
  Question,
  Review,
  AuditLog,
} from "../shared/types";

// ── Tasks ──

export function insertTask(task: Task): void {
  getDb()
    .prepare(
      `INSERT INTO tasks (id, title, description, created_by, assigned_to, status, quadrant, deadline, parent_task_id, created_at, updated_at)
       VALUES (@id, @title, @description, @created_by, @assigned_to, @status, @quadrant, @deadline, @parent_task_id, @created_at, @updated_at)`
    )
    .run(task);
}

export function updateTask(
  id: string,
  updates: Record<string, unknown>
): void {
  const sets = Object.keys(updates)
    .map((k) => `${k} = @${k}`)
    .join(", ");
  getDb()
    .prepare(`UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = @id`)
    .run({ ...updates, id });
}

export function getTaskById(id: string): Task | undefined {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(id) as Task | undefined;
}

export function listTasks(filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  quadrant?: string;
  parent_task_id?: string;
}): Task[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      conditions.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`)
    .all(params) as Task[];
}

export function getSubTasks(parentId: string): Task[] {
  return getDb()
    .prepare("SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC")
    .all(parentId) as Task[];
}

export function deleteTask(id: string): void {
  getDb().prepare("DELETE FROM tasks WHERE id = ?").run(id);
}

// ── Questions ──

export function insertQuestion(question: Question): void {
  getDb()
    .prepare(
      `INSERT INTO questions (id, task_id, created_by, assigned_to, question_type, question_text, options, answer, status, created_at, answered_at)
       VALUES (@id, @task_id, @created_by, @assigned_to, @question_type, @question_text, @options, @answer, @status, @created_at, @answered_at)`
    )
    .run(question);
}

export function updateQuestionAnswer(
  id: string,
  answer: string,
  answeredAt: string
): void {
  getDb()
    .prepare(
      "UPDATE questions SET answer = ?, status = 'answered', answered_at = ? WHERE id = ?"
    )
    .run(answer, answeredAt, id);
}

export function getQuestionById(id: string): Question | undefined {
  return getDb()
    .prepare("SELECT * FROM questions WHERE id = ?")
    .get(id) as Question | undefined;
}

export function listQuestions(filters: {
  status?: string;
  assigned_to?: string;
  created_by?: string;
  task_id?: string;
}): Question[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined) {
      conditions.push(`${key} = @${key}`);
      params[key] = value;
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return getDb()
    .prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC`)
    .all(params) as Question[];
}

// ── Reviews ──

export function insertReview(review: Review): void {
  getDb()
    .prepare(
      `INSERT INTO reviews (id, task_id, reviewer, approved, comment, created_at)
       VALUES (@id, @task_id, @reviewer, @approved, @comment, @created_at)`
    )
    .run(review);
}

export function getReviewsByTaskId(taskId: string): Review[] {
  return getDb()
    .prepare("SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at DESC")
    .all(taskId) as Review[];
}

export function listReviews(filters: { task_id?: string }): Review[] {
  if (filters.task_id) {
    return getReviewsByTaskId(filters.task_id);
  }
  return getDb()
    .prepare("SELECT * FROM reviews ORDER BY created_at DESC")
    .all() as Review[];
}

// ── Audit Logs ──

export function insertAuditLog(log: AuditLog): void {
  getDb()
    .prepare(
      `INSERT INTO audit_logs (id, task_id, actor, action, old_value, new_value, timestamp)
       VALUES (@id, @task_id, @actor, @action, @old_value, @new_value, @timestamp)`
    )
    .run(log);
}

export function getAuditLogsByTaskId(taskId: string): AuditLog[] {
  return getDb()
    .prepare("SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp ASC")
    .all(taskId) as AuditLog[];
}

// ── Dashboard Aggregation ──

export function countTasksByStatus(): Record<string, number> {
  const rows = getDb()
    .prepare(
      "SELECT status, COUNT(*) as count FROM tasks WHERE status NOT IN ('archived') GROUP BY status"
    )
    .all() as Array<{ status: string; count: number }>;

  const result: Record<string, number> = {
    pending: 0,
    in_progress: 0,
    blocked: 0,
    review: 0,
    completed: 0,
  };
  for (const row of rows) {
    result[row.status] = row.count;
  }
  return result;
}

export function countUnansweredQuestions(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'pending'")
    .get() as { count: number };
  return row.count;
}

export function countNewlyAnsweredQuestions(): number {
  const row = getDb()
    .prepare(
      "SELECT COUNT(*) as count FROM questions WHERE status = 'answered' AND answered_at > datetime('now', '-24 hours')"
    )
    .get() as { count: number };
  return row.count;
}

export function getMostUrgentTask(): {
  task_id: string;
  title: string;
  deadline: string;
} | null {
  const row = getDb()
    .prepare(
      `SELECT id as task_id, title, deadline FROM tasks
       WHERE status NOT IN ('completed', 'archived') AND deadline IS NOT NULL
       ORDER BY deadline ASC LIMIT 1`
    )
    .get() as { task_id: string; title: string; deadline: string } | undefined;
  return row || null;
}

export function getItemsWaitingForBoss(): Array<{
  type: string;
  id: string;
  task_id?: string;
  title?: string;
  waiting_since: string;
}> {
  const questions = getDb()
    .prepare(
      `SELECT 'question' as type, q.id, q.task_id, q.question_text as title, q.created_at as waiting_since
       FROM questions q WHERE q.status = 'pending' AND q.assigned_to = 'boss'
       ORDER BY q.created_at ASC`
    )
    .all() as Array<{
    type: string;
    id: string;
    task_id: string | null;
    title: string;
    waiting_since: string;
  }>;

  const reviews = getDb()
    .prepare(
      `SELECT 'review' as type, t.id, t.id as task_id, t.title, t.updated_at as waiting_since
       FROM tasks t WHERE t.status = 'review'
       ORDER BY t.updated_at ASC`
    )
    .all() as Array<{
    type: string;
    id: string;
    task_id: string;
    title: string;
    waiting_since: string;
  }>;

  return [...questions, ...reviews].sort(
    (a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime()
  );
}

export function getFeedbackHistory(
  agentId?: string,
  limit: number = 20
): Review[] {
  if (agentId) {
    return getDb()
      .prepare(
        `SELECT r.* FROM reviews r
         JOIN tasks t ON r.task_id = t.id
         WHERE t.assigned_to = ?
         ORDER BY r.created_at DESC LIMIT ?`
      )
      .all(agentId, limit) as Review[];
  }
  return getDb()
    .prepare("SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Review[];
}

export function getTasksInReview(agentId?: string): Task[] {
  if (agentId) {
    return getDb()
      .prepare(
        "SELECT * FROM tasks WHERE status = 'review' AND assigned_to = ? ORDER BY updated_at ASC"
      )
      .all(agentId) as Task[];
  }
  return getDb()
    .prepare("SELECT * FROM tasks WHERE status = 'review' ORDER BY updated_at ASC")
    .all() as Task[];
}
