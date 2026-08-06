import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// Add a question to the student's personal question bank (שאלת שאלות).
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const question = String(body?.question ?? "").trim().slice(0, 2000);
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const sourceRef = body?.sourceRef ? String(body.sourceRef).slice(0, 200) : null;
  if (!question) {
    return NextResponse.json({ error: "שאלה ריקה." }, { status: 400 });
  }
  await db().execute({
    sql: `INSERT INTO question_bank (user_id, task_id, source_ref, question, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [Number(user.id), taskId, sourceRef, question, now()],
  });
  return NextResponse.json({ ok: true });
}

// Star / unstar / choose-for-seminar.
export async function PATCH(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const id = Number(body?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  if (body?.starred != null) {
    await db().execute({
      sql: "UPDATE question_bank SET starred = ? WHERE id = ? AND user_id = ?",
      args: [body.starred ? 1 : 0, id, Number(user.id)],
    });
  }
  if (body?.chosenForSeminar != null) {
    // Only one chosen question at a time.
    await db().execute({
      sql: "UPDATE question_bank SET chosen_for_seminar = 0 WHERE user_id = ?",
      args: [Number(user.id)],
    });
    await db().execute({
      sql: "UPDATE question_bank SET chosen_for_seminar = ? WHERE id = ? AND user_id = ?",
      args: [body.chosenForSeminar ? 1 : 0, id, Number(user.id)],
    });
  }
  return NextResponse.json({ ok: true });
}
