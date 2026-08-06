import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now } from "@/lib/tasks";

// Save one answer. Blocked after submission (must un-submit first).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const questionKey = String(body?.questionKey ?? "").slice(0, 100);
  const answer = String(body?.answer ?? "").slice(0, 20000);
  if (!questionKey) {
    return NextResponse.json({ error: "questionKey חסר." }, { status: 400 });
  }

  const t = now();
  await db().execute({
    sql: `INSERT INTO task_answers (task_id, user_id, question_key, answer, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id, question_key) DO UPDATE SET
            answer = excluded.answer, updated_at = excluded.updated_at`,
    args: [guard.task.id, guard.userId, questionKey, answer, t],
  });
  return NextResponse.json({ ok: true });
}
