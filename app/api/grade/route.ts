import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { now } from "@/lib/tasks";
import { approveGrade } from "@/lib/grade-assist";

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

  if (approve) {
    await approveGrade({ taskId, studentId, score, feedback, teacherId: guard.userId });
    return NextResponse.json({ ok: true });
  }

  const t = now();
  await db().execute({
    sql: `INSERT INTO grades (task_id, user_id, score, feedback, graded_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            score = excluded.score,
            feedback = excluded.feedback,
            graded_by = excluded.graded_by,
            updated_at = excluded.updated_at`,
    args: [taskId, studentId, score, feedback, guard.userId, t],
  });
  return NextResponse.json({ ok: true });
}
