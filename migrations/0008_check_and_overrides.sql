-- Comprehension check results (one attempt per student per task) and the
-- teacher's in-place content edits. Both tables are also created lazily by
-- lib/check.ts and lib/content-overrides.ts, so production needs no manual
-- migration; this file is the canonical DDL for fresh databases.

CREATE TABLE IF NOT EXISTS check_results (
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  correct INTEGER NOT NULL,
  total INTEGER NOT NULL,
  answers_json TEXT NOT NULL,
  open_answer TEXT,
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS task_content_overrides (
  content_ref TEXT NOT NULL,
  field TEXT NOT NULL,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  updated_by INTEGER,
  PRIMARY KEY (content_ref, field)
);
