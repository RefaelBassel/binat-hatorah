import { db } from "./db";
import { getMessagesUnreadCount } from "./messages";

// Unread count for the top-nav bell: notifications + chat messages
// (direct + group). Falls back to zero when the DB is unreachable.
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const res = await db().execute({
      sql: "SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL",
      args: [userId],
    });
    const notif = Number(res.rows[0]?.c ?? 0);
    const msgs = await getMessagesUnreadCount(userId);
    return notif + msgs;
  } catch {
    return 0;
  }
}
