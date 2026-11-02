#!/usr/bin/env bash
set -euo pipefail

DB_PATH="${1:-${ATB_DB_PATH:-$HOME/.pepper-tasks/data.db}}"
OUT_PATH="${2:-tmp/pepper-tasks-d1-import.sql}"
BACKUP_PATH="${3:-tmp/pepper-tasks-local-backup.sqlite}"

mkdir -p "$(dirname "$OUT_PATH")" "$(dirname "$BACKUP_PATH")"

if [[ ! -f "$DB_PATH" ]]; then
  echo "SQLite database not found: $DB_PATH" >&2
  exit 1
fi

rm -f "$BACKUP_PATH" "$OUT_PATH"

sqlite3 "$DB_PATH" "PRAGMA wal_checkpoint(TRUNCATE); VACUUM INTO '$BACKUP_PATH';"
sqlite3 "$BACKUP_PATH" "PRAGMA foreign_key_check;"

{
  echo "PRAGMA defer_foreign_keys=TRUE;"
  echo "DELETE FROM audit_logs;"
  echo "DELETE FROM reviews;"
  echo "DELETE FROM questions;"
  echo "DELETE FROM tasks;"
  sqlite3 "$BACKUP_PATH" <<'SQL'
SELECT 'INSERT INTO tasks (id,title,description,created_by,assigned_to,status,quadrant,task_type,deadline,parent_task_id,created_at,updated_at) VALUES(' ||
  quote(id) || ',' || quote(title) || ',' || quote(description) || ',' ||
  quote(created_by) || ',' || quote(assigned_to) || ',' || quote(status) || ',' ||
  quote(quadrant) || ',' || quote(task_type) || ',' || quote(deadline) || ',' ||
  quote(parent_task_id) || ',' || quote(created_at) || ',' || quote(updated_at) || ');'
FROM tasks;
SELECT 'INSERT INTO questions (id,task_id,created_by,assigned_to,question_type,question_text,description,options,answer,status,created_at,answered_at) VALUES(' ||
  quote(id) || ',' || quote(task_id) || ',' || quote(created_by) || ',' ||
  quote(assigned_to) || ',' || quote(question_type) || ',' || quote(question_text) || ',' ||
  quote(description) || ',' || quote(options) || ',' || quote(answer) || ',' ||
  quote(status) || ',' || quote(created_at) || ',' || quote(answered_at) || ');'
FROM questions;
SELECT 'INSERT INTO reviews (id,task_id,reviewer,approved,comment,created_at) VALUES(' ||
  quote(id) || ',' || quote(task_id) || ',' || quote(reviewer) || ',' ||
  quote(approved) || ',' || quote(comment) || ',' || quote(created_at) || ');'
FROM reviews;
SELECT 'INSERT INTO audit_logs (id,task_id,actor,action,old_value,new_value,timestamp) VALUES(' ||
  quote(id) || ',' || quote(task_id) || ',' || quote(actor) || ',' ||
  quote(action) || ',' || quote(old_value) || ',' || quote(new_value) || ',' ||
  quote(timestamp) || ');'
FROM audit_logs;
SQL
} > "$OUT_PATH"

sqlite3 "$BACKUP_PATH" \
  "SELECT 'tasks', count(*) FROM tasks UNION ALL
   SELECT 'questions', count(*) FROM questions UNION ALL
   SELECT 'reviews', count(*) FROM reviews UNION ALL
   SELECT 'audit_logs', count(*) FROM audit_logs;"

echo "Wrote D1 import SQL: $OUT_PATH"
echo "Wrote local backup: $BACKUP_PATH"
