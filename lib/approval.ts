import { db } from "./db";
import { createNotification, teacherIds } from "./notify";

// Account approval. A Google sign-in no longer grants access by itself:
// every non-teacher account starts PENDING and sees only /pending until a
// teacher approves it (bell notification, never email). Teachers on the
// lib/roles.ts whitelist are always approved. A blocked account is kept
// (with its work) but cannot get past the gate.

let columnsReady = false;
export async function ensureApprovalColumns() {
  if (columnsReady) return;
  const info = await db().execute("PRAGMA table_info(users)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("approved_at")) {
    await db().execute("ALTER TABLE users ADD COLUMN approved_at INTEGER");
  }
  if (!cols.has("blocked_at")) {
    await db().execute("ALTER TABLE users ADD COLUMN blocked_at INTEGER");
  }
  // teachers are always in
  await db().execute(
    "UPDATE users SET approved_at = COALESCE(approved_at, created_at) WHERE role = 'teacher'"
  );
  columnsReady = true;
}

export type AccountState = "approved" | "pending" | "blocked";

export async function accountStateFor(email: string): Promise<AccountState | null> {
  await ensureApprovalColumns();
  const res = await db().execute({
    sql: "SELECT role, approved_at, blocked_at FROM users WHERE email = ?",
    args: [email.toLowerCase()],
  });
  const r = res.rows[0];
  if (!r) return null;
  if (r.blocked_at != null) return "blocked";
  if (r.role === "teacher" || r.approved_at != null) return "approved";
  return "pending";
}

const now = () => Math.floor(Date.now() / 1000);

export async function approveUser(userId: number) {
  await ensureApprovalColumns();
  await db().execute({
    sql: "UPDATE users SET approved_at = ?, blocked_at = NULL WHERE id = ?",
    args: [now(), userId],
  });
  await createNotification({
    userId,
    kind: `approved:${userId}`,
    title: "החשבון שלך אושר — ברוכים הבאים לבינת התורה 🌱",
    link: "/",
  });
}

export async function blockUser(userId: number) {
  await ensureApprovalColumns();
  await db().execute({
    sql: "UPDATE users SET blocked_at = ? WHERE id = ? AND role <> 'teacher'",
    args: [now(), userId],
  });
}

export async function unblockUser(userId: number) {
  await ensureApprovalColumns();
  await db().execute({
    sql: "UPDATE users SET blocked_at = NULL, approved_at = COALESCE(approved_at, ?) WHERE id = ?",
    args: [now(), userId],
  });
}

// Pre-approve an email so the student walks straight in on first sign-in.
export async function preApproveEmail(email: string) {
  await ensureApprovalColumns();
  const e = email.toLowerCase().trim();
  if (!e.includes("@")) return false;
  const t = now();
  await db().execute({
    sql: `INSERT INTO users (email, role, created_at, approved_at)
          VALUES (?, 'student', ?, ?)
          ON CONFLICT(email) DO UPDATE SET approved_at = COALESCE(users.approved_at, ?), blocked_at = NULL`,
    args: [e, t, t, t],
  });
  return true;
}

// Full removal of an account that does not belong to the class (Rafael:
// "אפשרות הסרה לכל מי שנכנסו והם לא מהכיתה"). Everything the account left
// behind goes with it; the teacher confirms first in the UI. Teachers can
// never be removed this way.
export async function removeUser(userId: number) {
  await ensureApprovalColumns();
  for (const table of [
    "task_assignments",
    "task_progress",
    "task_answers",
    "text_markings",
    "grades",
    "reflections",
    "notifications",
    "question_bank",
    "assist_log",
    "focus_events",
    "check_results",
    "writing_results",
    "debate_votes",
    "group_message_reads",
  ]) {
    try {
      await db().execute({ sql: `DELETE FROM ${table} WHERE user_id = ?`, args: [userId] });
    } catch {
      /* table may not exist yet (created lazily) */
    }
  }
  for (const [table, col] of [
    ["messages", "from_user_id"],
    ["messages", "to_user_id"],
    ["group_messages", "from_user_id"],
  ] as const) {
    await db().execute({ sql: `DELETE FROM ${table} WHERE ${col} = ?`, args: [userId] });
  }
  await db().execute({
    sql: "DELETE FROM users WHERE id = ? AND role <> 'teacher'",
    args: [userId],
  });
}

export interface AccountRow {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
  createdAt: number;
  lastSeenAt: number | null;
  onboardedAt: number | null;
  state: AccountState;
  hasWork: boolean;
}

export async function listAccounts(): Promise<AccountRow[]> {
  await ensureApprovalColumns();
  const res = await db().execute({
    sql: `SELECT u.id, u.email, u.full_name, u.role, u.created_at, u.last_seen_at,
                 u.onboarded_at, u.approved_at, u.blocked_at,
                 EXISTS(SELECT 1 FROM task_answers a WHERE a.user_id = u.id) AS has_work
          FROM users u
          ORDER BY (u.approved_at IS NULL AND u.blocked_at IS NULL) DESC, u.created_at DESC`,
    args: [],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    fullName: (r.full_name as string | null) ?? null,
    role: String(r.role),
    createdAt: Number(r.created_at),
    lastSeenAt: r.last_seen_at != null ? Number(r.last_seen_at) : null,
    onboardedAt: r.onboarded_at != null ? Number(r.onboarded_at) : null,
    state:
      r.blocked_at != null
        ? "blocked"
        : r.role === "teacher" || r.approved_at != null
          ? "approved"
          : "pending",
    hasWork: Boolean(Number(r.has_work)),
  }));
}

// Bell (never email) to every teacher when a new account is waiting.
export async function announcePendingAccount(email: string, name: string | null) {
  const teachers = await teacherIds();
  for (const t of teachers) {
    await createNotification({
      userId: t.id,
      kind: `pending:${email}`,
      title: `חשבון חדש מבקש להיכנס: ${name ?? email}`,
      body: "לאישור או להסרה — ברשימת התלמידים בדשבורד.",
      link: "/dashboard/students",
    });
  }
}
