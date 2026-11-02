import type Database from "better-sqlite3";
import { getDb } from "./connection";
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

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database.Database = getDb()) {}

  async transaction<T>(callback: (repo: TaskRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async insertTask(task: Task): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO tasks (id, title, description, created_by, assigned_to, status, quadrant, task_type, deadline, parent_task_id, created_at, updated_at)
         VALUES (@id, @title, @description, @created_by, @assigned_to, @status, @quadrant, @task_type, @deadline, @parent_task_id, @created_at, @updated_at)`
      )
      .run(task);
  }

  async updateTask(id: string, updates: Record<string, unknown>): Promise<void> {
    const entries = Object.entries(updates).filter(([key]) =>
      TASK_UPDATE_COLUMNS.has(key)
    );
    if (entries.length === 0) return;

    const sets = entries.map(([key]) => `${key} = @${key}`).join(", ");
    const params = Object.fromEntries(entries);
    this.db
      .prepare(`UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = @id`)
      .run({ ...params, id });
  }

  async getTaskById(id: string): Promise<Task | undefined> {
    return this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as
      | Task
      | undefined;
  }

  async listTasks(filters: TaskFilters): Promise<Task[]> {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value === undefined) continue;
      if (key === "search") {
        conditions.push("(title LIKE @search OR description LIKE @search)");
        params.search = `%${value}%`;
      } else if (TASK_FILTER_COLUMNS.has(key)) {
        conditions.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db
      .prepare(`SELECT * FROM tasks ${where} ORDER BY created_at DESC`)
      .all(params) as Task[];
  }

  async getSubTasks(parentId: string): Promise<Task[]> {
    return this.db
      .prepare("SELECT * FROM tasks WHERE parent_task_id = ? ORDER BY created_at ASC")
      .all(parentId) as Task[];
  }

  async deleteTask(id: string): Promise<void> {
    this.db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  }

  async insertQuestion(question: Question): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO questions (id, task_id, created_by, assigned_to, question_type, question_text, description, options, answer, status, created_at, answered_at)
         VALUES (@id, @task_id, @created_by, @assigned_to, @question_type, @question_text, @description, @options, @answer, @status, @created_at, @answered_at)`
      )
      .run(question);
  }

  async updateQuestionAnswer(
    id: string,
    answer: string,
    answeredAt: string
  ): Promise<void> {
    this.db
      .prepare(
        "UPDATE questions SET answer = ?, status = 'answered', answered_at = ? WHERE id = ?"
      )
      .run(answer, answeredAt, id);
  }

  async updateQuestionStatus(id: string, status: string): Promise<void> {
    this.db.prepare("UPDATE questions SET status = ? WHERE id = ?").run(status, id);
  }

  async getQuestionById(id: string): Promise<Question | undefined> {
    return this.db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as
      | Question
      | undefined;
  }

  async listQuestions(filters: QuestionFilters): Promise<Question[]> {
    const conditions: string[] = [];
    const params: Record<string, string> = {};

    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && QUESTION_FILTER_COLUMNS.has(key)) {
        conditions.push(`${key} = @${key}`);
        params[key] = value;
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    return this.db
      .prepare(`SELECT * FROM questions ${where} ORDER BY created_at DESC`)
      .all(params) as Question[];
  }

  async insertReview(review: Review): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO reviews (id, task_id, reviewer, approved, comment, created_at)
         VALUES (@id, @task_id, @reviewer, @approved, @comment, @created_at)`
      )
      .run(review);
  }

  async getReviewsByTaskId(taskId: string): Promise<Review[]> {
    return this.db
      .prepare("SELECT * FROM reviews WHERE task_id = ? ORDER BY created_at DESC")
      .all(taskId) as Review[];
  }

  async listReviews(filters: { task_id?: string }): Promise<Review[]> {
    if (filters.task_id) return this.getReviewsByTaskId(filters.task_id);
    return this.db.prepare("SELECT * FROM reviews ORDER BY created_at DESC").all() as Review[];
  }

  async insertAuditLog(log: AuditLog): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, task_id, actor, action, old_value, new_value, timestamp)
         VALUES (@id, @task_id, @actor, @action, @old_value, @new_value, @timestamp)`
      )
      .run(log);
  }

  async getAuditLogsByTaskId(taskId: string): Promise<AuditLog[]> {
    return this.db
      .prepare("SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp ASC")
      .all(taskId) as AuditLog[];
  }

  async countTasksByStatus(): Promise<Record<string, number>> {
    const rows = this.db
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
    for (const row of rows) result[row.status] = row.count;
    return result;
  }

  async countUnansweredQuestions(): Promise<number> {
    const row = this.db
      .prepare("SELECT COUNT(*) as count FROM questions WHERE status = 'pending'")
      .get() as { count: number };
    return row.count;
  }

  async countNewlyAnsweredQuestions(): Promise<number> {
    const row = this.db
      .prepare(
        "SELECT COUNT(*) as count FROM questions WHERE status = 'answered' AND answered_at > datetime('now', '-24 hours')"
      )
      .get() as { count: number };
    return row.count;
  }

  async getMostUrgentTask(): Promise<UrgentTask | null> {
    const row = this.db
      .prepare(
        `SELECT id as task_id, title, deadline FROM tasks
         WHERE status NOT IN ('completed', 'archived') AND deadline IS NOT NULL
         ORDER BY deadline ASC LIMIT 1`
      )
      .get() as UrgentTask | undefined;
    return row || null;
  }

  async getItemsWaitingForBoss(): Promise<WaitingItem[]> {
    const questions = this.db
      .prepare(
        `SELECT 'question' as type, q.id, q.task_id, q.question_text as title, q.created_at as waiting_since
         FROM questions q WHERE q.status = 'pending' AND q.assigned_to = 'boss'
         ORDER BY q.created_at ASC`
      )
      .all() as WaitingItem[];

    const reviews = this.db
      .prepare(
        `SELECT 'review' as type, t.id, t.id as task_id, t.title, t.updated_at as waiting_since
         FROM tasks t WHERE t.status = 'review'
         ORDER BY t.updated_at ASC`
      )
      .all() as WaitingItem[];

    return [...questions, ...reviews].sort(
      (a, b) => new Date(a.waiting_since).getTime() - new Date(b.waiting_since).getTime()
    );
  }

  async getOrphanTasks(): Promise<OrphanTask[]> {
    return this.db
      .prepare(
        `SELECT t.id as task_id, t.title, t.status, t.assigned_to, t.updated_at as stuck_since
         FROM tasks t
         WHERE t.status IN ('pending', 'in_progress', 'blocked')
         AND t.id NOT IN (
           SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
         )
         ORDER BY t.updated_at ASC`
      )
      .all() as OrphanTask[];
  }

  async autoArchiveEphemeralTasks(): Promise<number> {
    return this.db
      .prepare(
        `UPDATE tasks SET status = 'archived', updated_at = datetime('now')
         WHERE task_type = 'ephemeral' AND status = 'completed'
         AND updated_at < datetime('now', '-48 hours')`
      )
      .run().changes;
  }

  async acknowledgeAnsweredQuestions(taskId: string): Promise<number> {
    return this.db
      .prepare(
        "UPDATE questions SET status = 'acknowledged' WHERE task_id = ? AND status = 'answered'"
      )
      .run(taskId).changes;
  }

  async getActionItems(agentId?: string, cutoffDays: number = 7): Promise<ActionItem[]> {
    const answeredWithTask = this.db
      .prepare(
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
         ORDER BY MAX(q.answered_at) ASC`
      )
      .all(cutoffDays) as ActionItem[];

    const answeredNoTask = this.db
      .prepare(
        `SELECT 1 as priority, 'answered_question' as type, q.id, q.task_id,
                q.question_text as title, q.answer as context, q.answered_at as since
         FROM questions q
         WHERE q.status = 'answered' AND q.task_id IS NULL
         AND q.answered_at > datetime('now', '-' || ? || ' days')
         ORDER BY q.answered_at ASC`
      )
      .all(cutoffDays) as ActionItem[];

    const rejectedTasks = this.db
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
      .all() as ActionItem[];

    const orphanSql = `SELECT 3 as priority, 'orphan_task' as type, t.id, t.id as task_id,
              t.title, t.status as context, t.updated_at as since
       FROM tasks t
       WHERE t.status IN ('pending', 'in_progress', 'blocked')
       AND t.id NOT IN (
         SELECT DISTINCT task_id FROM questions WHERE task_id IS NOT NULL AND status = 'pending'
       )
       ${agentId ? "AND t.assigned_to = ?" : ""}
       ORDER BY t.updated_at ASC`;
    const orphans = (agentId
      ? this.db.prepare(orphanSql).all(agentId)
      : this.db.prepare(orphanSql).all()) as ActionItem[];

    const inProgress = agentId
      ? (this.db
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
          .all(agentId) as ActionItem[])
      : [];

    const pending = agentId
      ? (this.db
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
          .all(agentId) as ActionItem[])
      : [];

    return [...answeredWithTask, ...answeredNoTask, ...rejectedTasks, ...orphans, ...inProgress, ...pending];
  }

  async getFeedbackHistory(agentId?: string, limit: number = 20): Promise<Review[]> {
    if (agentId) {
      return this.db
        .prepare(
          `SELECT r.* FROM reviews r
           JOIN tasks t ON r.task_id = t.id
           WHERE t.assigned_to = ?
           ORDER BY r.created_at DESC LIMIT ?`
        )
        .all(agentId, limit) as Review[];
    }
    return this.db
      .prepare("SELECT * FROM reviews ORDER BY created_at DESC LIMIT ?")
      .all(limit) as Review[];
  }

  async getTasksInReview(agentId?: string): Promise<Task[]> {
    if (agentId) {
      return this.db
        .prepare("SELECT * FROM tasks WHERE status = 'review' AND assigned_to = ? ORDER BY updated_at ASC")
        .all(agentId) as Task[];
    }
    return this.db
      .prepare("SELECT * FROM tasks WHERE status = 'review' ORDER BY updated_at ASC")
      .all() as Task[];
  }
}

let localRepository: SqliteTaskRepository | null = null;

export function getLocalRepository(): SqliteTaskRepository {
  if (!localRepository) localRepository = new SqliteTaskRepository();
  return localRepository;
}
