-- Teacher-only review presentations (issue #48). Slides (title, bullets,
-- speaker notes) are stored as JSON. Also applied lazily by lib/decks.ts.
CREATE TABLE IF NOT EXISTS exam_decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  exam_id INTEGER REFERENCES exam_docs(id),
  slides_json TEXT NOT NULL DEFAULT '[]',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exam_decks_exam ON exam_decks(exam_id);
