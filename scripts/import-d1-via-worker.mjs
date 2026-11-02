#!/usr/bin/env node
import Database from "better-sqlite3";

const dbPath = process.argv[2] || "tmp/pepper-tasks-local-backup.sqlite";
const baseUrl = process.env.ATB_IMPORT_URL || "https://todo.aceonhuang.com";
const token = process.env.ATB_IMPORT_TOKEN;
const batchSize = Number(process.env.ATB_IMPORT_BATCH_SIZE || "25");

if (!token) {
  console.error("ATB_IMPORT_TOKEN is required.");
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

const tables = [
  {
    name: "tasks",
    sql: `SELECT id, title, description, created_by, assigned_to, status, quadrant,
                 task_type, deadline, parent_task_id, created_at, updated_at
          FROM tasks ORDER BY created_at ASC`,
  },
  {
    name: "questions",
    sql: `SELECT id, task_id, created_by, assigned_to, question_type, question_text,
                 description, options, answer, status, created_at, answered_at
          FROM questions ORDER BY created_at ASC`,
  },
  {
    name: "reviews",
    sql: `SELECT id, task_id, reviewer, approved, comment, created_at
          FROM reviews ORDER BY created_at ASC`,
  },
  {
    name: "audit_logs",
    sql: `SELECT id, task_id, actor, action, old_value, new_value, timestamp
          FROM audit_logs ORDER BY timestamp ASC`,
  },
];

await post("/__admin/import/reset", {});

for (const table of tables) {
  const rows = db.prepare(table.sql).all();
  let imported = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    await post("/__admin/import/batch", { table: table.name, rows: chunk });
    imported += chunk.length;
    process.stdout.write(`${table.name}: ${imported}/${rows.length}\r`);
  }
  process.stdout.write(`${table.name}: ${imported}/${rows.length}\n`);
}

function endpoint(path) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

async function post(path, body) {
  const response = await fetch(endpoint(path), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-import-token": token,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }
}
