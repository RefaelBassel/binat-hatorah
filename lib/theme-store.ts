import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "./db";
import { THEME_COOKIE, isTheme, type Theme } from "./theme";

// The theme to server-render for this request: the account's choice, else
// this device's cookie, else null (THEME_INIT_SCRIPT decides on the client).
// Cached per request — the root layout, top nav and /me all ask.
export const currentTheme = cache(async (): Promise<Theme | null> => {
  try {
    const { auth } = await import("@/auth");
    const session = await auth();
    const user = session?.user;
    if (user?.id && !user.guest) {
      const saved = await getUserTheme(Number(user.id));
      if (saved) return saved;
    }
  } catch {
    /* DB unavailable — fall back to the cookie */
  }
  const c = (await cookies()).get(THEME_COOKIE)?.value;
  return isTheme(c) ? c : null;
});

// users.theme read/write (migrations/0012_user_theme.sql).
let columnReady = false;

async function ensureThemeColumn() {
  if (columnReady) return;
  const info = await db().execute("PRAGMA table_info(users)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("theme")) {
    await db().execute("ALTER TABLE users ADD COLUMN theme TEXT");
  }
  columnReady = true;
}

export async function getUserTheme(userId: number): Promise<Theme | null> {
  await ensureThemeColumn();
  const res = await db().execute({
    sql: "SELECT theme FROM users WHERE id = ?",
    args: [userId],
  });
  const t = res.rows[0]?.theme;
  return isTheme(t) ? t : null;
}

export async function setUserTheme(userId: number, theme: Theme) {
  await ensureThemeColumn();
  await db().execute({
    sql: "UPDATE users SET theme = ? WHERE id = ?",
    args: [theme, userId],
  });
}
