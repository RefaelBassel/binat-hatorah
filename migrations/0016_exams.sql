-- Exams area (/dashboard/exams): exams and prep sheets the teacher edits
-- herself. One table for both kinds; the editable document lives in
-- `content` (JSON). `published_content` is the student copy (rubric removed)
-- frozen at publish time — students never read `content`.
-- Also applied lazily by lib/exams.ts (CREATE IF NOT EXISTS); this file is
-- the canonical DDL.
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,                       -- 'exam' | 'prep'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published_content TEXT,
  linked_exam_id INTEGER REFERENCES exams(id),  -- prep sheet -> its exam
  status TEXT NOT NULL DEFAULT 'draft',     -- 'draft' | 'published'
  published_at INTEGER,
  opens_at INTEGER,                         -- exam: when students may start
  duration_min INTEGER,                     -- exam: time limit once started
  created_by INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exam_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  label TEXT,
  created_at INTEGER NOT NULL
);

-- One attempt per (exam, student). `scores` / `claude_scores` are JSON maps
-- of answer key -> points; `score` is the approved total.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  started_at INTEGER NOT NULL,
  deadline_at INTEGER NOT NULL,
  submitted_at INTEGER,
  answers TEXT NOT NULL DEFAULT '{}',
  claude_scores TEXT,
  claude_feedback TEXT,
  claude_error TEXT,
  scores TEXT,
  feedback TEXT,
  score REAL,
  approved_at INTEGER,
  updated_at INTEGER NOT NULL,
  UNIQUE(exam_id, user_id)
);

CREATE TABLE IF NOT EXISTS exam_meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_exam_versions_exam ON exam_versions(exam_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id);
