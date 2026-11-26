-- Shared "tips from marking the previous exam" box shown on every prep sheet (issue #65).
CREATE TABLE IF NOT EXISTS exam_tips (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL,
  items_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
