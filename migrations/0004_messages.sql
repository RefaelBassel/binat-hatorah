-- Messages (קשר): 1:1 threads (student ↔ teacher) + one class-wide group
-- chat. Pattern ported from בינת התלמוד. Messages are kept forever.

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  to_user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  sent_at INTEGER NOT NULL,
  read_at INTEGER,
  link TEXT
);
CREATE INDEX IF NOT EXISTS idx_messages_to ON messages(to_user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages(from_user_id, to_user_id);

CREATE TABLE IF NOT EXISTS group_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL DEFAULT 'all',
  from_user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  sent_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_messages ON group_messages(group_id, id);

CREATE TABLE IF NOT EXISTS group_message_reads (
  group_id TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_message_id INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, user_id)
);
