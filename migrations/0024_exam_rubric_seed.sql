-- Marking guide of the seeded exam (issue #60): remembers that the sample
-- answers were filled in once, so later teacher edits are never overwritten.
-- Also applied lazily by lib/exams.ts.
ALTER TABLE exam_docs ADD COLUMN rubric_seeded_at INTEGER;
