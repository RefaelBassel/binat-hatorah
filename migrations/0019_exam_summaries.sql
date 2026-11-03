-- Student summaries for exam preparation (issue #28): one row per
-- (exam, student, unit) with the four summary fields and free notes.
-- Private to the student and the teachers. Also applied lazily by
-- lib/exam-summaries.ts (CREATE ... IF NOT EXISTS); this file is the canonical DDL.
CREATE TABLE IF NOT EXISTS exam_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  unit_key TEXT NOT NULL,
  what_happened TEXT NOT NULL DEFAULT '',
  key_verse TEXT NOT NULL DEFAULT '',
  commentator TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE(exam_id, user_id, unit_key)
);
CREATE INDEX IF NOT EXISTS idx_exam_summaries_exam ON exam_summaries(exam_id);
