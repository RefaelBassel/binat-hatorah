-- General study guides (issue #27): a prep sheet that is not tied to one exam
-- can still be linked to any exam. Also applied lazily by lib/exams.ts.
ALTER TABLE exam_docs ADD COLUMN linked_exam_id INTEGER;
