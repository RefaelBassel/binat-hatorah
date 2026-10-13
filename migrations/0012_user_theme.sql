-- Display theme chosen with the moon/sun toggle: 'light' | 'dark'. NULL = no
-- choice yet (the device's prefers-color-scheme decides). Also applied lazily
-- by lib/theme.ts (PRAGMA-guarded); this file is the canonical DDL.
ALTER TABLE users ADD COLUMN theme TEXT;
