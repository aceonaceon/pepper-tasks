import type {
  ActionItem,
  OrphanTask,
  QuestionFilters,
  TaskFilters,
  TaskRepository,
  UrgentTask,
  WaitingItem,
} from "./repository";
import type { AuditLog, Question, Review, Task } from "../shared/types";

type SqlValue = string | number | boolean | null;

const TASK_UPDATE_COLUMNS = new Set([
  "title",
  "description",
  "assigned_to",
  "status",
  "quadrant",
  "task_type",
  "deadline",
  "parent_task_id",
]);

const TASK_FILTER_COLUMNS = new Set([
  "status",
  "assigned_to",
  "created_by",
  "quadrant",
  "parent_task_id",
]);

const QUESTION_FILTER_COLUMNS = new Set([
  "status",
  "assigned_to",
  "created_by",
  "task_id",
]);

export class D1TaskRepository implements TaskRepository {
  constructor(
    private readonly db: D1Database,
    private readonly batchStatements?: D1PreparedStatement[]
  ) {}

  async transaction<T>(callback: (repo: TaskRepository) => Promise<T>): Promise<T> {
    const statements: D1PreparedStatement[] = [];
    const repo = new D1TaskRepository(this.db, statements);
    const result = await callback(repo);
    if (statements.length > 0) await this.db.batch(statements);
    return result;
  }

  async insertTask(task: Task): Promise<void> {
    await this.run(
      `INSERT INTO tasks (id, title, description, created_by, assigned_to, status, quadrant, task_type, deadline, parent_task_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        task.id,
        task.title,
        task.description,
        task.created_by,
        task.assigned_to,
        task.status,
        task.quadrant,
        task.task_type,
        task.deadline,
        task.parent_task_id,
        task.created_at,
        task.updated_at,
      ]
    );
  }

  async updateTask(id: string, updates: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(updates).filter(([key]) =>
      TASK_UPDATE_COLUMNS.has(key)
    );
    if (entries.length === 0) return;

    const sets = entries.map(([key]) => `${key} = ?`).join(", ");
    await this.run(
      `UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = ?`,
      [...entries.map(([, value]) => toSqlValue(value)), id]
    );
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return (await this.first<Task>("SELECT * FROM tasks WHERE id = ?", [id])) || undefined;
  }

  async listTasks(filters: TaskFilters): Promise<Task[]> {
    const { where, params } = buildTaskWhere(filters);
    return this.all<Task>(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`, params);
  }

  async getSubTasks(parentId: string): Promise<Task[]> {
    return this.all<Task>(
      "SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC",
      [parentId]
    );
  }

  async deleteTask(id: string): Promise<void> {
    await this.run("DELETE FROM tasks WHERE id = ?", [id]);
  }

  async insertQuestion(question: Question): Promise<void> {
    await this.run(
      `INSERT INTO questions (id, task_id, created_by, assigned_to, question_type, question_text, description, options, answer, status, created_at, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        question.id,
        question.task_id,
        question.created_by,
        question.assigned_to,
        question.question_type,
        question.question_text,
        question.description,
        question.options,
        question.answer,
        question.status,
        question.created_at,
        question.answered_at,
      ]
    );
  }

  async updateQuestionAnswer(
    id: string,
    answer: string,
    answeredAt: string
  ): Promise<void> {
    await this.run(
      "UPDATE questions SET answer = ?, status = 'answered', answered_at = ? WHERE id = ?",
      [answer, answeredAt, id]
    );
  }

  async updateQuestionStatus(id: string, status: string): Promise<void> {
    await this.run("UPDATE questions SET status = ? WHERE id = ?", [status, id]);
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return (await this.first<Question>("SELECT * FROM questions WHERE id = ?", [id])) || undefined;
  }

  async listQuestions(filters: QuestionFilters): Promise<Question[]> {
    const { where, params } = buildQuestionWhere(filters);
    return this.all<Question>(
      `SELECT * FROM questions ${where} ORDER BY created_at DESC`,
      params
    );
  }

  async insertReview(review: Review): Promise<void> {
    await this.run(
      `INSERT INTO reviews (id, task_id, reviewer, approved, comment, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        review.id,
        review.task_id,
        review.reviewer,
        review.approved,
        review.comment,
        review.created_at,
      ]
    );
  }

  async getReviewsByTaskId(taskId: string): Promise<Review[]> {
    return this.all<Review>(
      "SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at DESC",
      [taskId]
    );
  }

  async listReviews(filters: { task_id?: string }): Promise<Review[]> {
    if (filters.task_id) return this.getReviewsByTaskId(filters.task_id);
    return this.all<Review>("SELECT * FROM reviews ORDER BY created_at DESC");
  }

  async insertAuditLog(log: AuditLog): Promise<void> {
    await this.run(
      `INSERT INTO audit_logs (id, task_id, actor, action, old_value, new_value, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.task_id,
        log.actor,
        log.action,
        log.old_value,
        log.new_value,
        log.timestamp,
      ]
    );
  }

  async getAuditLogsByTaskId(taskId: string): Promise<AuditLog[]> {
    return this.all<AuditLog>(
      "SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp ASC",
      [taskId]
    );
  }

  async countTasksByStatus(): Promise<Record<string, number>> {
    const rows = await this.all<{ status: string; count: number }>(
      "SELECT status, COUNT(*) as count FROM tasks WHERE status NOT IN ('archived') GROUP BY status"
    );
    const result: Record<string, number> = {
      pending: 0,
      in_progress: 0,
      blocked: 0,
      review: 0,
      completed: 0,
    };
    for (const row of rows) result[row.status] = row.count;
    return result;
  }

  async countUnansweredQuestions(): Promise<number> {
    const row = await this.first<{ count: number }>(
      "SELECT COUNT(*) as count FROM questions WHERE status = 'pending'"
    );
    return row?.count ?? 0;
  }

  async countNewlyAnsweredQuestions(): Promise<number> {
    const row = await this.first<{ count: number }>(
      "SELECT COUNT(*) as count FROM questions WHERE status = 'answered' AND answered_at > datetime('now', '-24 hours')"
    );
    return row?.count ?? 0;
  }

  async getMostUrgentTask(): Promise<UrgentTask | null> {
    return this.first<UrgentTask>(
      `SELECT id as task_id, title, deadline FROM tasks
       WHERE status NOT IN ('completed', 'archived') AND deadline IS NOT NULL
       ORDER BY deadline ASC LIMIT 1`
    );
  }

  async getItemsWaitingForBoss(): Promise<WaitingItem[]> {
    const questions = await this.all<WaitingItem>(
      `SELECT 'question' as type, q.id, q.task_id, q.question_text as title, q.created_at as waiting_since
       FROM questions q WHERE q.status = 'pending' AND q.assigned_to = 'boss'
       ORDER BY q.created_at ASC`
    );
    const reviews = await this.all<WaitingItem>(
      `SELECT 'review' as type, t.id, t.id as task_id, t.title, t.updated_at as waiting_since
       FROM tasks t WHERE t.status = 'review'
       ORDER BY t.updated_at ASC`
    );
    return [...questions, ...reviews].sort(
      (a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime()
    );
  }

  async getOrphanTasks(): Promise<OrphanTask[]> {
    return this.all<OrphanTask>(
      `SELECT t.id as task_id, t.title, t.status, t.assigned_to, t.updated_at as stuck_since
       FROM tasks t
       WHERE t.status IN ('pending', 'in_progress', 'blocked')
       AND t.id NOT IN (
         SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
       )
       ORDER BY t.updated_at ASC`
    );
  }

  async autoArchiveEphemeralTasks(): Promise<number> {
    return this.run(
      `UPDATE tasks SET status = 'archived', updated_at = datetime('now')
       WHERE task_type = 'ephemeral' AND status = 'completed'
       AND updated_at < datetime('now', '-48 hours')`
    );
  }

  async acknowledgeAnsweredQuestions(taskId: string): Promise<number> {
    return this.run(
      "UPDATE questions SET status = 'acknowledged' WHERE task_id = ? AND status = 'answered'",
      [taskId]
    );
  }

  async getActionItems(agentId?: string, cutoffDays: number = 7): Promise<ActionItem[]> {
    const answeredWithTask = await this.all<ActionItem>(
      `SELECT 1 as priority, 'answered_question' as type,
              (SELECT q2.id FROM questions q2
               WHERE q2.task_id = q.task_id AND q2.status = 'answered'
               ORDER BY q2.answered_at DESC LIMIT 1) as id,
              q.task_id,
              COALESCE(t.title, q.task_id) as title,
              COUNT(*) || ' 個已回覆問題；最新：' || substr(
                (SELECT q3.answer FROM questions q3
                 WHERE q3.task_id = q.task_id AND q3.status = 'answered'
                 ORDER BY q3.answered_at DESC LIMIT 1), 1, 120
              ) as context,
              MAX(q.answered_at) as since
       FROM questions q
       LEFT JOIN tasks t ON q.task_id = t.id
       WHERE q.status = 'answered' AND q.task_id IS NOT NULL
       AND q.answered_at > datetime('now', '-' || ? || ' days')
       GROUP BY q.task_id
       ORDER BY MAX(q.answered_at) ASC`,
      [cutoffDays]
    );

    const answeredNoTask = await this.all<ActionItem>(
      `SELECT 1 as priority, 'answered_question' as type, q.id, q.task_id,
              q.question_text as title, q.answer as context, q.answered_at as since
       FROM questions q
       WHERE q.status = 'answered' AND q.task_id IS NULL
       AND q.answered_at > datetime('now', '-' || ? || ' days')
       ORDER BY q.answered_at ASC`,
      [cutoffDays]
    );

    const rejectedTasks = await this.all<ActionItem>(
      `SELECT 2 as priority, 'rejected_review' as type, t.id, t.id as task_id,
              t.title, r.comment as context, r.created_at as since
       FROM reviews r
       JOIN tasks t ON r.task_id = t.id
       WHERE r.approved = 0 AND t.status = 'in_progress'
       AND r.created_at > datetime('now', '-48 hours')
       AND r.id = (SELECT id FROM reviews WHERE task_id = t.id ORDER BY created_at DESC LIMIT 1)
       ORDER BY r.created_at ASC`
    );

    const orphanSql = `SELECT 3 as priority, 'orphan_task' as type, t.id, t.id as task_id,
              t.title, t.status as context, t.updated_at as since
       FROM tasks t
       WHERE t.status IN ('pending', 'in_progress', 'blocked')
       AND t.id NOT IN (
         SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
       )
       ${agentId ? "AND t.assigned_to = ?" : ""}
       ORDER BY t.updated_at ASC`;
    const orphans = await this.all<ActionItem>(orphanSql, agentId ? [agentId] : []);

    const inProgress = agentId
      ? await this.all<ActionItem>(
          `SELECT 4 as priority, 'in_progress_task' as type, t.id, t.id as task_id,
                  t.title, substr(t.description, 1, 200) as context, t.updated_at as since
           FROM tasks t
           WHERE t.status = 'in_progress' AND t.assigned_to = ?
           AND t.id IN (
             SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
           )
           ORDER BY t.updated_at ASC`,
          [agentId]
        )
      : [];

    const pending = agentId
      ? await this.all<ActionItem>(
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
             END, t.created_at ASC`,
          [agentId]
        )
      : [];

    return [...answeredWithTask, ...answeredNoTask, ...rejectedTasks, ...orphans, ...inProgress, ...pending];
  }

  async getFeedbackHistory(agentId?: string, limit: number = 20): Promise<Review[]> {
    if (agentId) {
      return this.all<Review>(
        `SELECT r.* FROM reviews r
         JOIN tasks t ON r.task_id = t.id
         WHERE t.assigned_to = ?
         ORDER BY r.created_at DESC LIMIT ?`,
        [agentId, limit]
      );
    }
    return this.all<Review>("SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?", [limit]);
  }

  async getTasksInReview(agentId?: string): Promise<Task[]> {
    if (agentId) {
      return this.all<Task>(
        "SELECT * FROM tasks WHERE status = 'review' AND assigned_to = ? ORDER BY updated_at ASC",
        [agentId]
      );
    }
    return this.all<Task>(
      "SELECT * FROM tasks WHERE status = 'review' ORDER BY updated_at ASC"
    );
  }

  private statement(sql: string, params: SqlValue[] = []): D1PreparedStatement {
    return this.db.prepare(sql).bind(...params);
  }

  private async run(sql: string, params: SqlValue[] = []): Promise<number> {
    const stmt = this.statement(sql, params);
    if (this.batchStatements) {
      this.batchStatements.push(stmt);
      return 0;
    }
    const result = await stmt.run();
    return Number(result.meta?.changes ?? 0);
  }

  private async first<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    if (this.batchStatements) {
      throw new Error("D1 transaction callbacks may only enqueue writes");
    }
    return this.statement(sql, params).first<T>();
  }

  private async all<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    if (this.batchStatements) {
      throw new Error("D1 transaction callbacks may only enqueue writes");
    }
    const result = await this.statement(sql, params).all<T>();
    return result.results ?? [];
  }
}

function buildTaskWhere(filters: TaskFilters): { where: string; params: SqlValue[] } {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined) continue;
    if (key === "search") {
      conditions.push("(title LIKE ? OR description LIKE ?)");
      params.push(`%${value}%`, `%${value}%`);
    } else if (TASK_FILTER_COLUMNS.has(key)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function buildQuestionWhere(filters: QuestionFilters): { where: string; params: SqlValue[] } {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && QUESTION_FILTER_COLUMNS.has(key)) {
      conditions.push(`${key} = ?`);
      params.push(value);
    }
  }

  return {
    where: conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "",
    params,
  };
}

function toSqlValue(value: unknown): SqlValue {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }
  throw new Error(`Unsupported SQL value: ${String(value)}`);
}
