-- Account approval gate: a Google sign-in creates a PENDING account that a
-- teacher must approve; blocked accounts keep their work but cannot enter.
-- Also applied lazily by lib/approval.ts (PRAGMA-guarded), so production
-- needs no manual run; this file is the canonical DDL for fresh databases.
ALTER TABLE users ADD COLUMN approved_at INTEGER;
ALTER TABLE users ADD COLUMN blocked_at INTEGER;
UPDATE users SET approved_at = created_at WHERE role = 'teacher';
