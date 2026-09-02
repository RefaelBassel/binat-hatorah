-- Task cancellation markers: a cancelled task is removed from every
-- student (assignments deleted; saved work kept) and skipped by the
-- onboarding auto-assignment for late joiners. The app also creates this
-- table lazily (lib/tasks.ts ensureCancellationsTable), so production
-- works without running this file; it exists for fresh databases.
CREATE TABLE IF NOT EXISTS task_cancellations (
  task_id INTEGER PRIMARY KEY REFERENCES tasks(id),
  cancelled_at INTEGER NOT NULL
);
