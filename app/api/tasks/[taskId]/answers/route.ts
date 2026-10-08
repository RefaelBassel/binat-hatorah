import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now } from "@/lib/tasks";
import { checkAnswerSave, recordTelemetry, taskCorpus } from "@/lib/typing-guard";

// Save one answer. Blocked after submission (must un-submit first).
// Students' saves pass the server-side pace check (lib/typing-guard.ts):
// text that arrives faster than a person can type is refused with 409 and
// the last accepted text, and the page puts it back. Teachers walking a
// task are exempt.
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

  if (!guard.isTeacher) {
    const prevRes = await db().execute({
      sql: "SELECT answer FROM task_answers WHERE task_id = ? AND user_id = ? AND question_key = ?",
      args: [guard.task.id, guard.userId, questionKey],
    });
    const prev = String(prevRes.rows[0]?.answer ?? "");
    const corpus = await taskCorpus(guard.task.content_ref);
    await recordTelemetry(guard.task.id, guard.userId, body?.telemetry);
    const verdict = await checkAnswerSave({
      taskId: guard.task.id,
      userId: guard.userId,
      prev,
      next: answer,
      corpus,
    });
    if (!verdict.ok) {
      return NextResponse.json({ error: verdict.message, answer: prev }, { status: 409 });
    }
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
