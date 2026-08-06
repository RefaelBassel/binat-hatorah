import { db } from "./db";

// ===========================================================================
// Messages (קשר) — 1:1 threads + one class-wide group chat. Ported from
// בינת התלמוד (gemara10 lib/messages.ts), without the class field.
// ===========================================================================

export interface Message {
  id: number;
  fromUserId: number;
  toUserId: number;
  body: string;
  sentAt: number;
  readAt: number | null;
  link: string | null;
}

export interface ThreadSummary {
  otherUserId: number;
  otherFullName: string | null;
  otherRole: "student" | "teacher";
  lastMessage: Message;
  unreadCount: number;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function getDirectUnreadCount(userId: number): Promise<number> {
  const r = await db().execute({
    sql: "SELECT COUNT(*) AS n FROM messages WHERE to_user_id = ? AND read_at IS NULL",
    args: [userId],
  });
  return Number(r.rows[0]?.n ?? 0);
}

// Total unread messages (direct + group) — feeds the top-nav bell together
// with the notifications count.
export async function getMessagesUnreadCount(userId: number): Promise<number> {
  const direct = await getDirectUnreadCount(userId);
  const group = await getGroupUnreadCount(userId);
  return direct + group;
}

export async function loadThread(userIdA: number, userIdB: number): Promise<Message[]> {
  const r = await db().execute({
    sql: `SELECT id, from_user_id, to_user_id, body, sent_at, read_at, link
          FROM messages
          WHERE (from_user_id = ? AND to_user_id = ?)
             OR (from_user_id = ? AND to_user_id = ?)
          ORDER BY sent_at ASC, id ASC`,
    args: [userIdA, userIdB, userIdB, userIdA],
  });
  return r.rows.map(rowToMessage);
}

export async function loadThreadsFor(userId: number): Promise<ThreadSummary[]> {
  const partnersResult = await db().execute({
    sql: `SELECT DISTINCT other_id FROM (
            SELECT to_user_id   AS other_id FROM messages WHERE from_user_id = ?
            UNION
            SELECT from_user_id AS other_id FROM messages WHERE to_user_id = ?
          )`,
    args: [userId, userId],
  });
  const partnerIds = partnersResult.rows.map((r) => Number(r.other_id));
  if (partnerIds.length === 0) return [];

  const placeholders = partnerIds.map(() => "?").join(", ");
  const profilesResult = await db().execute({
    sql: `SELECT id, full_name, role FROM users WHERE id IN (${placeholders})`,
    args: partnerIds,
  });
  const profileById = new Map(
    profilesResult.rows.map((r) => [
      Number(r.id),
      {
        fullName: (r.full_name as string | null) ?? null,
        role: (r.role as "student" | "teacher") ?? "student",
      },
    ])
  );

  const summaries: ThreadSummary[] = [];
  for (const otherId of partnerIds) {
    const lastResult = await db().execute({
      sql: `SELECT id, from_user_id, to_user_id, body, sent_at, read_at, link
            FROM messages
            WHERE (from_user_id = ? AND to_user_id = ?)
               OR (from_user_id = ? AND to_user_id = ?)
            ORDER BY sent_at DESC, id DESC LIMIT 1`,
      args: [userId, otherId, otherId, userId],
    });
    const last = lastResult.rows[0];
    if (!last) continue;
    const unreadResult = await db().execute({
      sql: `SELECT COUNT(*) AS n FROM messages
            WHERE from_user_id = ? AND to_user_id = ? AND read_at IS NULL`,
      args: [otherId, userId],
    });
    const profile = profileById.get(otherId) ?? { fullName: null, role: "student" as const };
    summaries.push({
      otherUserId: otherId,
      otherFullName: profile.fullName,
      otherRole: profile.role,
      lastMessage: rowToMessage(last),
      unreadCount: Number(unreadResult.rows[0]?.n ?? 0),
    });
  }
  summaries.sort((a, b) => b.lastMessage.sentAt - a.lastMessage.sentAt);
  return summaries;
}

export async function sendMessage(
  fromUserId: number,
  toUserId: number,
  body: string,
  link?: string | null
): Promise<number> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty message body");
  if (fromUserId === toUserId) throw new Error("Cannot send a message to yourself");
  const r = await db().execute({
    sql: "INSERT INTO messages (from_user_id, to_user_id, body, sent_at, link) VALUES (?, ?, ?, ?, ?)",
    args: [fromUserId, toUserId, trimmed, now(), link?.trim() || null],
  });
  return Number(r.lastInsertRowid ?? 0);
}

export async function markThreadRead(viewerUserId: number, otherUserId: number) {
  await db().execute({
    sql: `UPDATE messages SET read_at = ?
          WHERE to_user_id = ? AND from_user_id = ? AND read_at IS NULL`,
    args: [now(), viewerUserId, otherUserId],
  });
}

export async function listTeachers() {
  const r = await db().execute({
    sql: "SELECT id, full_name, email FROM users WHERE role = 'teacher' ORDER BY full_name, email",
    args: [],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    fullName: (row.full_name as string | null) ?? null,
    email: String(row.email),
  }));
}

function rowToMessage(row: Record<string, unknown>): Message {
  return {
    id: Number(row.id),
    fromUserId: Number(row.from_user_id),
    toUserId: Number(row.to_user_id),
    body: row.body as string,
    sentAt: Number(row.sent_at),
    readAt: row.read_at == null ? null : Number(row.read_at),
    link: (row.link as string | null) ?? null,
  };
}

// =====================================================================
// Group chat — one global group "all", every user implicitly a member.
// =====================================================================

export const DEFAULT_GROUP_ID = "all";

export interface GroupMessage {
  id: number;
  fromUserId: number;
  fromName: string | null;
  fromRole: "student" | "teacher";
  body: string;
  sentAt: number;
}

export async function getGroupUnreadCount(
  userId: number,
  groupId: string = DEFAULT_GROUP_ID
): Promise<number> {
  const r = await db().execute({
    sql: `SELECT COUNT(*) AS n FROM group_messages
          WHERE group_id = ?
            AND id > COALESCE(
              (SELECT last_read_message_id FROM group_message_reads WHERE group_id = ? AND user_id = ?),
              0)`,
    args: [groupId, groupId, userId],
  });
  return Number(r.rows[0]?.n ?? 0);
}

export async function loadGroupMessages(
  groupId: string = DEFAULT_GROUP_ID
): Promise<GroupMessage[]> {
  const r = await db().execute({
    sql: `SELECT g.id, g.from_user_id, g.body, g.sent_at,
                 u.full_name AS from_name, u.role AS from_role
          FROM group_messages g
          JOIN users u ON u.id = g.from_user_id
          WHERE g.group_id = ?
          ORDER BY g.sent_at ASC, g.id ASC`,
    args: [groupId],
  });
  return r.rows.map((row) => ({
    id: Number(row.id),
    fromUserId: Number(row.from_user_id),
    fromName: (row.from_name as string | null) ?? null,
    fromRole: (row.from_role as "student" | "teacher") ?? "student",
    body: row.body as string,
    sentAt: Number(row.sent_at),
  }));
}

export async function sendGroupMessage(
  fromUserId: number,
  body: string,
  groupId: string = DEFAULT_GROUP_ID
): Promise<number> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Empty message body");
  const r = await db().execute({
    sql: "INSERT INTO group_messages (group_id, from_user_id, body, sent_at) VALUES (?, ?, ?, ?)",
    args: [groupId, fromUserId, trimmed, now()],
  });
  return Number(r.lastInsertRowid ?? 0);
}

export async function markGroupRead(
  userId: number,
  groupId: string = DEFAULT_GROUP_ID
) {
  const r = await db().execute({
    sql: "SELECT MAX(id) AS max_id FROM group_messages WHERE group_id = ?",
    args: [groupId],
  });
  const maxId = Number(r.rows[0]?.max_id ?? 0);
  await db().execute({
    sql: `INSERT INTO group_message_reads (group_id, user_id, last_read_message_id)
          VALUES (?, ?, ?)
          ON CONFLICT(group_id, user_id) DO UPDATE SET last_read_message_id = excluded.last_read_message_id`,
    args: [groupId, userId, maxId],
  });
}
