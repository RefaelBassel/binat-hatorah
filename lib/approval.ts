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
    // one-time grandfathering (Rafael, 2026-09-27, option ב): every account
    // that existed before the gate stays in; the gate applies to newcomers,
    // and strangers already inside are removed by hand from the roster
    await db().execute("UPDATE users SET approved_at = created_at WHERE approved_at IS NULL");
  }
  if (!cols.has("blocked_at")) {
    await db().execute("ALTER TABLE users ADD COLUMN blocked_at INTEGER");
  }
  // account merges (issue #19): a secondary Google account points at the
  // account that now holds all its work (lib/account-merge.ts)
  if (!cols.has("merged_into")) {
    await db().execute("ALTER TABLE users ADD COLUMN merged_into INTEGER");
  }
  // teachers are always in
  await db().execute(
    "UPDATE users SET approved_at = COALESCE(approved_at, created_at) WHERE role = 'teacher'"
  );
  columnsReady = true;
}

export type AccountState = "approved" | "pending" | "blocked";

export interface ResolvedAccount {
  id: number;
  role: string;
  fullName: string | null;
  addressForm: string | null;
  onboarded: boolean;
  state: AccountState;
}

// The account an email signs in to. A merged secondary email resolves to
// the primary account it was merged into, so both emails land on the same
// student with all the work.
export async function resolveAccount(email: string): Promise<ResolvedAccount | null> {
  await ensureApprovalColumns();
  const res = await db().execute({
    sql: `SELECT u.id, u.role, u.full_name, u.address_form, u.onboarded_at,
                 u.approved_at, u.blocked_at
          FROM users e JOIN users u ON u.id = COALESCE(e.merged_into, e.id)
          WHERE e.email = ?`,
    args: [email.toLowerCase()],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    role: String(r.role),
    fullName: (r.full_name as string | null) ?? null,
    addressForm: (r.address_form as string | null) ?? null,
    onboarded: r.onboarded_at != null,
    state:
      r.blocked_at != null
        ? "blocked"
        : r.role === "teacher" || r.approved_at != null
          ? "approved"
          : "pending",
  };
}

export async function accountStateFor(email: string): Promise<AccountState | null> {
  return (await resolveAccount(email))?.state ?? null;
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
  // emails merged into this account (their work already lives here) go too
  await db().execute({
    sql: "DELETE FROM users WHERE merged_into = ? AND role <> 'teacher'",
    args: [userId],
  });
  await db().execute({
    sql: "DELETE FROM users WHERE id = ? AND role <> 'teacher'",
    args: [userId],
  });
}

// Teacher rename (issue #19): the display name shown everywhere — class
// pulse, submissions, messages.
export async function renameUser(userId: number, fullName: string) {
  await ensureApprovalColumns();
  await db().execute({
    sql: "UPDATE users SET full_name = ? WHERE id = ? AND merged_into IS NULL",
    args: [fullName, userId],
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
  // every email that signs in to this account: its own, then the emails of
  // accounts merged into it (lib/account-merge.ts)
  emails: string[];
}

// Merged secondary accounts are not listed: they live on as an extra email
// of their primary account.
export async function listAccounts(): Promise<AccountRow[]> {
  await ensureApprovalColumns();
  const res = await db().execute({
    sql: `SELECT u.id, u.email, u.full_name, u.role, u.created_at,
                 MAX(COALESCE(u.last_seen_at, 0),
                     COALESCE((SELECT MAX(m.last_seen_at) FROM users m WHERE m.merged_into = u.id), 0)) AS last_seen_at,
                 u.onboarded_at, u.approved_at, u.blocked_at,
                 (SELECT GROUP_CONCAT(m.email, ' ') FROM users m WHERE m.merged_into = u.id) AS linked,
                 EXISTS(SELECT 1 FROM task_answers a WHERE a.user_id = u.id) AS has_work
          FROM users u
          WHERE u.merged_into IS NULL
          ORDER BY (u.approved_at IS NULL AND u.blocked_at IS NULL) DESC, u.created_at DESC`,
    args: [],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    emails: [String(r.email), ...String(r.linked ?? "").split(" ").filter(Boolean)],
    fullName: (r.full_name as string | null) ?? null,
    role: String(r.role),
    createdAt: Number(r.created_at),
    lastSeenAt: Number(r.last_seen_at) > 0 ? Number(r.last_seen_at) : null,
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
