-- Students' exam practice area (issue #34). Also applied lazily by
-- lib/practice.ts; this file is the canonical DDL.

-- practice_json: lib/practice-types.ts PracticeSettings (units, flash cards,
-- open questions). practice_opened_at NULL = closed to students (default).
ALTER TABLE exam_docs ADD COLUMN practice_json TEXT;
ALTER TABLE exam_docs ADD COLUMN practice_opened_at INTEGER;

-- One row per practice action. kind: 'quiz' | 'card' | 'open' | 'mock'.
-- correct: quiz answer right / card "ידעתי" (1) or not (0); NULL otherwise.
-- seconds: active time since the previous action (capped). Never graded.
CREATE TABLE IF NOT EXISTS practice_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  unit_ref TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL,
  item_key TEXT NOT NULL DEFAULT '',
  correct INTEGER,
  seconds INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_practice_events_exam ON practice_events(exam_id, user_id);
