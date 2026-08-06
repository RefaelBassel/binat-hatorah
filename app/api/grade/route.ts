import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getTask, now } from "@/lib/tasks";
import { notifyStudent } from "@/lib/notify";

// Teacher saves (and optionally final-approves) a grade. On approval the
// student gets the grade by email + bell.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const studentId = Number(body?.userId);
  const score = Math.min(100, Math.max(0, Math.round(Number(body?.score))));
  const feedback = String(body?.feedback ?? "").slice(0, 10000);
  const approve = Boolean(body?.approve);

  if (!Number.isInteger(taskId) || !Number.isInteger(studentId) || !Number.isFinite(score)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const t = now();
  await db().execute({
    sql: `INSERT INTO grades (task_id, user_id, score, feedback, graded_by, approved_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            score = excluded.score,
            feedback = excluded.feedback,
            graded_by = excluded.graded_by,
            approved_at = COALESCE(excluded.approved_at, grades.approved_at),
            updated_at = excluded.updated_at`,
    args: [taskId, studentId, score, feedback, guard.userId, approve ? t : null, t],
  });

  if (approve) {
    const task = await getTask(taskId);
    await notifyStudent(studentId, {
      kind: `graded:${taskId}:${studentId}`,
      title: `המשימה ״${task?.title ?? ""}״ נבדקה — הציון: ${score}`,
      body: feedback ? `הערכת המורה: ${feedback.slice(0, 500)}` : undefined,
      link: `/tasks/${taskId}`,
    });
  }

  return NextResponse.json({ ok: true });
}
