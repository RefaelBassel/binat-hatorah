-- JSON exports of student-work rows taken before a one-time data fix
-- touches them (lib/task-merge.ts, issue #17). The app also creates this
-- table lazily, so production works without running this file; it exists
-- for fresh databases.
CREATE TABLE IF NOT EXISTS data_backups (
  name TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  payload TEXT NOT NULL
);
