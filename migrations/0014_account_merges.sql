-- Account merges (issue #19): a student who signed in with two Google
-- accounts is merged into one. The secondary user row stays only as a
-- second sign-in email pointing at the primary (merged_into); its work moves
-- to the primary. account_merges records each merge and its data_backups
-- export so "הפרדה" can restore both accounts. Also applied lazily by
-- lib/approval.ts and lib/account-merge.ts, so production needs no manual
-- run; this file is the canonical DDL for fresh databases.
ALTER TABLE users ADD COLUMN merged_into INTEGER;

CREATE TABLE IF NOT EXISTS account_merges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  primary_id INTEGER NOT NULL,
  secondary_id INTEGER NOT NULL,
  merged_by INTEGER,
  merged_at INTEGER NOT NULL,
  backup_name TEXT NOT NULL,
  unmerged_at INTEGER,
  unmerge_backup_name TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_account_merges_active
  ON account_merges(secondary_id) WHERE unmerged_at IS NULL;
