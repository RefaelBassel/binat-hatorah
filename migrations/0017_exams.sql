-- Exams area (issue #25): teacher-editable exams and preparation sheets,
-- their version history, and students' exam attempts. Also applied lazily by
-- lib/exams.ts (CREATE ... IF NOT EXISTS); this file is the canonical DDL.

-- kind: 'exam' | 'prep'. body_json: lib/exam-types.ts ExamBody / PrepBody.
-- published_at NULL = draft. opens_at: when students may start the exam.
-- prep_id: an exam's linked preparation sheet. seed_key: one-time seeding.
CREATE TABLE IF NOT EXISTS exam_docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  duration_min INTEGER,
  body_json TEXT NOT NULL,
  prep_id INTEGER,
  published_at INTEGER,
  opens_at INTEGER,
  seed_key TEXT UNIQUE,
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_doc_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL REFERENCES exam_docs(id),
  title TEXT NOT NULL,
  duration_min INTEGER,
  body_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One attempt per (exam, student). answers_json: {itemKey: text}.
-- claude_points_json / points_json: {itemKey: {points, note}}.
-- score / feedback are final once approved_at is set.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  started_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  submitted_at INTEGER,
  answers_json TEXT NOT NULL DEFAULT '{}',
  claude_points_json TEXT,
  claude_feedback TEXT,
  claude_error TEXT,
  points_json TEXT,
  score REAL,
  feedback TEXT,
  approved_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(exam_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_versions_doc ON exam_doc_versions(doc_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
