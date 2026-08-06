-- Core learning-tasks schema.
-- Content itself (texts, questions, decode stages) lives in /content as static
-- TypeScript keyed by content_ref; the DB stores assignment + student work.

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content_ref TEXT NOT NULL,            -- key into content/tasks registry, e.g. 'lesson-01'
  title TEXT NOT NULL,
  published_at INTEGER NOT NULL,        -- when students can see it
  due_at INTEGER NOT NULL,              -- final submission date (un-submit allowed until then)
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

-- Which students a task was assigned to (teacher assigns per-student).
CREATE TABLE IF NOT EXISTS task_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  assigned_at INTEGER NOT NULL,
  UNIQUE(task_id, user_id)
);

-- One row per (task, student): work-state, actual-work stopwatch, progress.
CREATE TABLE IF NOT EXISTS task_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  opened_at INTEGER,                    -- first open → stopwatch starts
  work_seconds INTEGER NOT NULL DEFAULT 0,  -- accumulated actual work time
  progress_pct INTEGER NOT NULL DEFAULT 0,  -- 0-100, done vs. remaining
  stage INTEGER NOT NULL DEFAULT 1,     -- current pshat-decode stage (1-8)
  submitted_at INTEGER,                 -- NULL = not currently submitted
  updated_at INTEGER NOT NULL,
  UNIQUE(task_id, user_id)
);

-- Open answers, keyed by the content question key.
CREATE TABLE IF NOT EXISTS task_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  question_key TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL,
  UNIQUE(task_id, user_id, question_key)
);

-- Word-level markings made during pshat decoding. Saved as part of the
-- submission — the teacher sees exactly how the student decoded the text.
-- kind: 'leitwort' | 'hard' | 'parallel' (תקבולת) | 'question'
CREATE TABLE IF NOT EXISTS text_markings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  passage_key TEXT NOT NULL,            -- which passage block in the content
  word_index INTEGER NOT NULL,          -- index of the word within the passage
  word_text TEXT NOT NULL,              -- denormalized for teacher display
  kind TEXT NOT NULL,
  note TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE(task_id, user_id, passage_key, word_index, kind)
);

-- Personal question bank (שאלת שאלות — נחמה ליבוביץ). Questions accumulate
-- across all tasks; the final mini-seminar work grows from ONE chosen question.
CREATE TABLE IF NOT EXISTS question_bank (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER REFERENCES tasks(id),  -- NULL if asked outside a task
  source_ref TEXT,                       -- e.g. 'במדבר ט, ז' or passage key
  question TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,    -- student marks favorites
  chosen_for_seminar INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Grading: Claude proposes, the teacher edits and gives final approval.
CREATE TABLE IF NOT EXISTS grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  claude_score INTEGER,
  claude_feedback TEXT,
  score INTEGER,                        -- teacher-approved final score
  feedback TEXT,                        -- teacher-approved final feedback
  graded_by INTEGER REFERENCES users(id),
  approved_at INTEGER,                  -- set on final approval → student notified
  updated_at INTEGER NOT NULL,
  UNIQUE(task_id, user_id)
);

-- Claude-assistance log: personalization memory per student ("learns the
-- specific student"), and an audit trail for the teacher.
CREATE TABLE IF NOT EXISTS assist_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER REFERENCES tasks(id),
  context TEXT NOT NULL,                -- stage / question key / free
  student_input TEXT,
  claude_reply TEXT,
  created_at INTEGER NOT NULL
);

-- The three long-term products.
CREATE TABLE IF NOT EXISTS products (
  key TEXT PRIMARY KEY,                 -- 'product-a' | 'product-b' | 'mini-seminar'
  title TEXT NOT NULL,
  description TEXT,
  opens_at INTEGER
);

-- Per-student roles on products (e.g. group roles on תוצר א).
CREATE TABLE IF NOT EXISTS product_roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_key TEXT NOT NULL REFERENCES products(key),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL,
  assigned_at INTEGER NOT NULL,
  UNIQUE(product_key, user_id)
);

INSERT OR IGNORE INTO products (key, title, description) VALUES
  ('product-a', 'תוצר א — נייר עמדה', 'ניתוח עימות קהילתי בחומש במדבר וכתיבת נייר עמדה מבוסס טיעון (מחצית א).'),
  ('product-b', 'תוצר ב — עבודת חקר', 'עבודת חקר PBL: אחריות קהילתית — מתנ"ך לאקטואליה, כולל תערוכת תוצרים (מחצית ב).'),
  ('mini-seminar', 'מיני-סמינריון', 'עבודה אישית על שאלה אחת שנבחרה ממאגר השאלות האישי שלך.');

CREATE INDEX IF NOT EXISTS idx_assignments_user ON task_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_task ON task_progress(task_id);
CREATE INDEX IF NOT EXISTS idx_answers_task_user ON task_answers(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_markings_task_user ON text_markings(task_id, user_id);
CREATE INDEX IF NOT EXISTS idx_qbank_user ON question_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_assist_user ON assist_log(user_id);
