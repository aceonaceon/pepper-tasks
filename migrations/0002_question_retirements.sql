CREATE TABLE IF NOT EXISTS question_retirements (
  question_id TEXT PRIMARY KEY REFERENCES questions(id),
  retirement_reason TEXT NOT NULL,
  retired_by TEXT NOT NULL,
  retired_at TEXT NOT NULL,
  replacement_question_id TEXT REFERENCES questions(id)
);
CREATE INDEX IF NOT EXISTS idx_question_retirements_replacement
  ON question_retirements(replacement_question_id);
