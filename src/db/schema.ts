import Database from "better-sqlite3";

export function initializeSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','in_progress','blocked','review','completed','archived')),
      quadrant TEXT DEFAULT 'not_urgent_not_important'
        CHECK(quadrant IN ('urgent_important','not_urgent_important',
                           'urgent_not_important','not_urgent_not_important')),
      deadline TEXT,
      parent_task_id TEXT REFERENCES tasks(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id),
      created_by TEXT NOT NULL,
      assigned_to TEXT NOT NULL,
      question_type TEXT NOT NULL
        CHECK(question_type IN ('yes_no','single_choice','multi_choice','datetime','open_ended')),
      question_text TEXT NOT NULL,
      description TEXT,
      options TEXT,
      answer TEXT,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','answered','acknowledged')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      answered_at TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      reviewer TEXT NOT NULL,
      approved INTEGER NOT NULL,
      comment TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id),
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      timestamp TEXT NOT NULL DEFAULT (datetime('now'))
    );

  `);

  // Migration: add description column to existing questions table
  try { db.exec("ALTER TABLE questions ADD COLUMN description TEXT"); } catch {}

  // Migration: add 'acknowledged' to questions status CHECK constraint
  // SQLite cannot ALTER CHECK constraints, so we recreate the table
  try {
    const hasAcknowledged = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='questions'"
    ).get() as { sql: string } | undefined;
    if (hasAcknowledged && !hasAcknowledged.sql.includes("acknowledged")) {
      db.exec(`
        CREATE TABLE questions_new (
          id TEXT PRIMARY KEY,
          task_id TEXT REFERENCES tasks(id),
          created_by TEXT NOT NULL,
          assigned_to TEXT NOT NULL,
          question_type TEXT NOT NULL
            CHECK(question_type IN ('yes_no','single_choice','multi_choice','datetime','open_ended')),
          question_text TEXT NOT NULL,
          description TEXT,
          options TEXT,
          answer TEXT,
          status TEXT NOT NULL DEFAULT 'pending'
            CHECK(status IN ('pending','answered','acknowledged')),
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          answered_at TEXT
        );
        INSERT INTO questions_new SELECT id, task_id, created_by, assigned_to, question_type, question_text, description, options, answer, status, created_at, answered_at FROM questions;
        DROP TABLE questions;
        ALTER TABLE questions_new RENAME TO questions;
      `);
    }
  } catch {}

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
    CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
    CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
    CREATE INDEX IF NOT EXISTS idx_questions_task ON questions(task_id);
    CREATE INDEX IF NOT EXISTS idx_questions_assigned ON questions(assigned_to);
    CREATE INDEX IF NOT EXISTS idx_reviews_task ON reviews(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_task ON audit_logs(task_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
  `);
}
