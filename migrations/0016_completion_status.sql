-- Completion status + per-answer marks instead of a numeric grade (#24).
-- claude_status / claude_marks: the automatic proposal ('done' | 'partial' |
-- 'not_done'; marks = JSON {questionKey: {mark, note}}, mark one of
-- 'correct' | 'incorrect' | 'partial' | 'irrelevant'). status / marks: the
-- teacher's draft, final once status_approved_at is set. Old numeric scores
-- stay in score / claude_score untouched. Also applied lazily by
-- lib/completion.ts (PRAGMA-guarded); this file is the canonical DDL.
ALTER TABLE grades ADD COLUMN claude_status TEXT;
ALTER TABLE grades ADD COLUMN claude_marks TEXT;
ALTER TABLE grades ADD COLUMN status TEXT;
ALTER TABLE grades ADD COLUMN marks TEXT;
ALTER TABLE grades ADD COLUMN status_approved_at INTEGER;
