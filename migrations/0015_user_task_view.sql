-- Worksheet layout chosen on the task page: 'slides' (one question at a
-- time, the default) | 'full' (the whole sub-task at once). NULL = default.
-- Also applied lazily by lib/task-view.ts (PRAGMA-guarded); this file is the
-- canonical DDL.
ALTER TABLE users ADD COLUMN task_view TEXT;
