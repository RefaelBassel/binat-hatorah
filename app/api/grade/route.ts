import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { now } from "@/lib/tasks";
import { approveGrade, ensureGradeAssistColumns } from "@/lib/grade-assist";
import { isCompletionStatus, parseMarks } from "@/lib/completion";

// Teacher saves (and optionally final-approves) the completion status, the
// per-answer marks and the general note. On approval the student sees them
// and is notified by email + bell. No numeric score (#24).
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const studentId = Number(body?.userId);
  const status = body?.status;
  const marks = parseMarks(body?.marks);
  const feedback = String(body?.feedback ?? "").slice(0, 10000);
  const approve = Boolean(body?.approve);

  if (!Number.isInteger(taskId) || !Number.isInteger(studentId) || !isCompletionStatus(status)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (approve) {
    await approveGrade({ taskId, studentId, status, marks, feedback, teacherId: guard.userId });
    return NextResponse.json({ ok: true });
  }

  await ensureGradeAssistColumns();
  const t = now();
  await db().execute({
    sql: `INSERT INTO grades (task_id, user_id, status, marks, feedback, graded_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            status = excluded.status,
            marks = excluded.marks,
            feedback = excluded.feedback,
            graded_by = excluded.graded_by,
            updated_at = excluded.updated_at`,
    args: [taskId, studentId, status, JSON.stringify(marks), feedback, guard.userId, t],
  });
  return NextResponse.json({ ok: true });
}
