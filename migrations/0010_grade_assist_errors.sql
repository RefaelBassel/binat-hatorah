-- Automatic grade proposals: remember the last failure so the submission page
-- can show the teacher a clear "failed — retry" message instead of a blank
-- panel. Also applied lazily by lib/grade-assist.ts (PRAGMA-guarded), so
-- production needs no manual run; this file is the canonical DDL.
ALTER TABLE grades ADD COLUMN claude_error TEXT;
ALTER TABLE grades ADD COLUMN claude_error_at INTEGER;
