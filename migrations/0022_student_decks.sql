-- Student copy of an exam's review presentation (issue #53). One row per exam
-- (UNIQUE exam_id: the copy is created exactly once). Speaker notes are kept
-- in the teacher's copy but never sent to students. Also applied lazily by
-- lib/student-decks.ts.
CREATE TABLE IF NOT EXISTS exam_student_decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL UNIQUE REFERENCES exam_docs(id),
  title TEXT NOT NULL DEFAULT '',
  slides_json TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
