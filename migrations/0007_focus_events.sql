-- Focus-mode events (מצב מיקוד): leaving the task window / blocked external
-- pastes, per (task, student). Transparent to students (they see their own
-- counter); teacher-private detail; class aggregate only on the projected
-- board; never changes a grade automatically.
-- The app also creates this table lazily (lib/tasks.ts ensureFocusTable),
-- so production works without running this file; it exists for fresh DBs.
CREATE TABLE IF NOT EXISTS focus_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,          -- 'blur' | 'paste-blocked'
  away_ms INTEGER,             -- blur only: how long outside the window
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_task_user ON focus_events(task_id, user_id);
