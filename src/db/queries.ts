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
  search?: string;
}): Task[] {
  const conditions: string[] = [];
  const params: Record<string, string> = {};

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (key === "search") {
      conditions.push("(title LIKE @search OR description LIKE @search)");
      params.search = `%${value}%`;
    } else {
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
      `INSERT INTO questions (id, task_id, created_by, assigned_to, question_type, question_text, description, options, answer, status, created_at, answered_at)
       VALUES (@id, @task_id, @created_by, @assigned_to, @question_type, @question_text, @description, @options, @answer, @status, @created_at, @answered_at)`
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

/**
 * Find orphan tasks: stuck in pending/in_progress/blocked but have no pending question.
 * These tasks need Agent attention but may have been forgotten.
 */
export function getOrphanTasks(): Array<{
  task_id: string;
  title: string;
  status: string;
  assigned_to: string;
  stuck_since: string;
}> {
  return getDb()
    .prepare(
      `SELECT t.id as task_id, t.title, t.status, t.assigned_to, t.updated_at as stuck_since
       FROM tasks t
       WHERE t.status IN ('pending', 'in_progress', 'blocked')
       AND t.id NOT IN (
         SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
       )
       ORDER BY t.updated_at ASC`
    )
    .all() as Array<{
    task_id: string;
    title: string;
    status: string;
    assigned_to: string;
    stuck_since: string;
  }>;
}

/**
 * Get a priority-sorted action items list for the Agent.
 * Agent just calls dashboard() once and processes items top-to-bottom.
 */
export function getActionItems(agentId?: string): Array<{
  priority: number;
  type: string;
  id: string;
  task_id: string | null;
  title: string;
  context: string | null;
  since: string;
}> {
  const db = getDb();
  const agentFilter = agentId ? ` AND t.assigned_to = '${agentId}'` : "";

  // Priority 1: Answered questions (boss replied, Agent hasn't processed)
  const answeredQs = db
    .prepare(
      `SELECT 1 as priority, 'answered_question' as type, q.id, q.task_id,
              q.question_text as title, q.answer as context, q.answered_at as since
       FROM questions q
       WHERE q.status = 'answered' AND q.answered_at > datetime('now', '-48 hours')
       ORDER BY q.answered_at ASC`
    )
    .all() as Array<any>;

  // Priority 2: Recently rejected tasks (boss gave feedback)
  const rejectedTasks = db
    .prepare(
      `SELECT 2 as priority, 'rejected_review' as type, t.id, t.id as task_id,
              t.title, r.comment as context, r.created_at as since
       FROM reviews r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.approved = 0 AND t.status = 'in_progress'
       AND r.created_at > datetime('now', '-48 hours')
       AND r.id = (SELECT id FROM reviews WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1)
       ORDER BY r.created_at ASC`
    )
    .all() as Array<any>;

  // Priority 3: Orphan tasks (stuck without pending question)
  const orphans = db
    .prepare(
      `SELECT 3 as priority, 'orphan_task' as type, t.id, t.id as task_id,
              t.title, t.status as context, t.updated_at as since
       FROM tasks t
       WHERE t.status IN ('pending', 'in_progress', 'blocked')
       AND t.id NOT IN (
         SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
       )
       ${agentFilter}
       ORDER BY t.updated_at ASC`
    )
    .all() as Array<any>;

  // Priority 4: In-progress tasks (Agent's own, continue from checkpoint)
  const inProgress = agentId
    ? (db
        .prepare(
          `SELECT 4 as priority, 'in_progress_task' as type, t.id, t.id as task_id,
                  t.title, substr(t.description, 1, 200) as context, t.updated_at as since
           FROM tasks t
           WHERE t.status = 'in_progress' AND t.assigned_to = ?
           AND t.id IN (
             SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
           )
           ORDER BY t.updated_at ASC`
        )
        .all(agentId) as Array<any>)
    : [];

  // Priority 5: Pending tasks
  const pending = agentId
    ? (db
        .prepare(
          `SELECT 5 as priority, 'pending_task' as type, t.id, t.id as task_id,
                  t.title, t.quadrant as context, t.created_at as since
           FROM tasks t
           WHERE t.status = 'pending' AND t.assigned_to = ?
           ORDER BY
             CASE t.quadrant
               WHEN 'urgent_important' THEN 1
               WHEN 'not_urgent_important' THEN 2
               WHEN 'urgent_not_important' THEN 3
               ELSE 4
             END, t.created_at ASC`
        )
        .all(agentId) as Array<any>)
    : [];

  return [...answeredQs, ...rejectedTasks, ...orphans, ...inProgress, ...pending];
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
