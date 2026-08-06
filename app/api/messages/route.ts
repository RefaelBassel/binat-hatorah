import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  loadThread,
  loadGroupMessages,
  sendMessage,
  sendGroupMessage,
  markThreadRead,
  markGroupRead,
} from "@/lib/messages";
import { createNotification } from "@/lib/notify";
import { db } from "@/lib/db";

// GET ?with=<userId> → 1:1 thread (marks it read)
// GET ?group=1      → group chat (marks it read)
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const userId = Number(user.id);
  const url = new URL(req.url);

  if (url.searchParams.get("group")) {
    const messages = await loadGroupMessages();
    await markGroupRead(userId);
    return NextResponse.json({ messages, me: userId });
  }

  const withId = Number(url.searchParams.get("with"));
  if (!Number.isInteger(withId)) {
    return NextResponse.json({ error: "חסר יעד." }, { status: 400 });
  }
  const messages = await loadThread(userId, withId);
  await markThreadRead(userId, withId);
  return NextResponse.json({ messages, me: userId });
}

// POST {toUserId, body} or {group: true, body}
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const userId = Number(user.id);
  const payload = await req.json().catch(() => null);
  const body = String(payload?.body ?? "").slice(0, 8000);
  if (!body.trim()) {
    return NextResponse.json({ error: "הודעה ריקה." }, { status: 400 });
  }

  const senderName = user.fullName ?? user.email ?? "";

  if (payload?.group) {
    await sendGroupMessage(userId, body);
    return NextResponse.json({ ok: true });
  }

  const toUserId = Number(payload?.toUserId);
  if (!Number.isInteger(toUserId)) {
    return NextResponse.json({ error: "חסר נמען." }, { status: 400 });
  }
  // Students may write only to teachers; teachers may write to anyone.
  if (user.role !== "teacher") {
    const t = await db().execute({
      sql: "SELECT role FROM users WHERE id = ?",
      args: [toUserId],
    });
    if (String(t.rows[0]?.role) !== "teacher") {
      return NextResponse.json({ error: "אפשר לכתוב רק למורות." }, { status: 403 });
    }
  }
  await sendMessage(userId, toUserId, body);
  // Bell-only notification (no email — chat stays light).
  await createNotification({
    userId: toUserId,
    kind: `message:${userId}`,
    title: `הודעה חדשה מ${senderName}`,
    body: body.slice(0, 120),
    link: "/messages",
  });
  return NextResponse.json({ ok: true });
}
