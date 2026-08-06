import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Teacher-only: wipe the teacher's OWN progress on a task so it can be
// experienced again from scratch in student mode (answers, markings, banked
// questions, stage, stopwatch, submission). Never touches student data.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest || user.role !== "teacher") {
    return NextResponse.json({ error: "למורות בלבד." }, { status: 403 });
  }
  const { taskId: raw } = await params;
  const taskId = Number(raw);
  if (!Number.isInteger(taskId)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  const userId = Number(user.id);
  const client = db();
  await client.execute({
    sql: "DELETE FROM task_answers WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  await client.execute({
    sql: "DELETE FROM text_markings WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  await client.execute({
    sql: "DELETE FROM question_bank WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  await client.execute({
    sql: "DELETE FROM task_progress WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  return NextResponse.json({ ok: true });
}
