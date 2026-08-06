-- Users: one row per Google account that ever signed in.
-- role: 'student' | 'teacher' (derived from lib/roles.ts whitelist on sign-in).
-- full_name: the Hebrew name entered at onboarding — displayed everywhere
-- instead of the Google profile name.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  google_id TEXT,
  role TEXT NOT NULL DEFAULT 'student',
  full_name TEXT,
  class TEXT DEFAULT 'י',
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER,
  onboarded_at INTEGER
);

-- In-app notifications for the top-nav bell (submissions, overdue tasks,
-- grades). Rows are created by later phases; the bell just counts unread.
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  created_at INTEGER NOT NULL,
  read_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at);
