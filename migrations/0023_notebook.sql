-- "המחברת שלי" (issue #52): a private notebook per student. One entry per
-- (student, Israel calendar day); entry_date is set once at creation and never
-- changes. body holds sanitized HTML (bold, lists, line breaks only).
-- Private to the student and the teachers; never graded or checked.
-- Also applied lazily by lib/notebook.ts (CREATE ... IF NOT EXISTS); this file
-- is the canonical DDL.
CREATE TABLE IF NOT EXISTS notebook_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  entry_date TEXT NOT NULL,            -- 'YYYY-MM-DD', Asia/Jerusalem
  title TEXT NOT NULL DEFAULT '',
  unit_key TEXT NOT NULL DEFAULT '',   -- tasks.content_ref, '' = none
  body TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_user_date ON notebook_entries(user_id, entry_date);
