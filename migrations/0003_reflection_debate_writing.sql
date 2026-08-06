-- Reflections: end-of-lesson (or anytime, via the side drawer) self-assessment.
-- Auto-captured context: task + Tanach chapter ref + timestamp.
CREATE TABLE IF NOT EXISTS reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER REFERENCES tasks(id),
  context_ref TEXT,                     -- e.g. 'במדבר ט׳ · ״לָמָּה נִגָּרַע?״' or page name
  difficulty INTEGER NOT NULL,          -- 1-10: קל מאוד → קשה מאוד
  pshat_progress INTEGER NOT NULL,      -- 1-10: progress feeling in pshat-decoding skill
  argument_progress INTEGER NOT NULL,   -- 1-10: progress feeling in argument skill
  note TEXT,                            -- free text
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id, created_at);

-- Debates. One debate event holds several questions, each with two groups.
CREATE TABLE IF NOT EXISTS debates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | live | done
  current_question_id INTEGER,
  current_stage INTEGER NOT NULL DEFAULT 0,  -- index into the stage list
  stage_started_at INTEGER,             -- unix; NULL = timer not running
  stage_remaining INTEGER,              -- seconds left when paused
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS debate_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  debate_id INTEGER NOT NULL REFERENCES debates(id),
  order_idx INTEGER NOT NULL,
  question TEXT NOT NULL,
  position_a TEXT NOT NULL,             -- the stance group A defends
  position_b TEXT NOT NULL,
  group_a TEXT NOT NULL,                -- group display name
  group_b TEXT NOT NULL,
  votes_open INTEGER NOT NULL DEFAULT 0,
  done INTEGER NOT NULL DEFAULT 0
);

-- Audience voting in the argument-skill language: 4 axes, each a slider
-- between the two groups: -2..-1 = A stronger, 0 = tie, 1..2 = B stronger.
CREATE TABLE IF NOT EXISTS debate_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id INTEGER NOT NULL REFERENCES debate_questions(id),
  voter_id INTEGER NOT NULL REFERENCES users(id),
  ax_reasons INTEGER NOT NULL,          -- חוזק הנימוקים והראיות
  ax_assumptions INTEGER NOT NULL,      -- חשיפת הנחות היסוד של היריב
  ax_logic INTEGER NOT NULL,            -- לוגיקה של המסקנות
  ax_rebuttal INTEGER NOT NULL,         -- מענה להתקפות
  created_at INTEGER NOT NULL,
  UNIQUE(question_id, voter_id)
);

-- Argumentative-writing practice results. One row per (student, exercise);
-- retries update the row (latest attempt kept, best score preserved).
CREATE TABLE IF NOT EXISTS writing_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  exercise_key TEXT NOT NULL,
  score INTEGER,                        -- 0-100; NULL = awaiting evaluation
  answers TEXT NOT NULL,                -- JSON of the student's answers
  claude_feedback TEXT,
  updated_at INTEGER NOT NULL,
  UNIQUE(user_id, exercise_key)
);
CREATE INDEX IF NOT EXISTS idx_writing_user ON writing_results(user_id);
