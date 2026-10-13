-- Automatic grade proposals for every submission. claude_attempts counts
-- consecutive failed automatic runs (the cron stops after three, and the
-- teacher retries by hand); claude_submitted_at is the submission a proposal
-- was written for, so a re-submission gets a fresh one. Also applied lazily
-- by lib/grade-assist.ts (PRAGMA-guarded); this file is the canonical DDL.
ALTER TABLE grades ADD COLUMN claude_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE grades ADD COLUMN claude_submitted_at INTEGER;
