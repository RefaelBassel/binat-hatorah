import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { proposeGrade, ensureGradeAssistColumns } from "@/lib/grade-assist";
import { isCompletionStatus, parseMarks } from "@/lib/completion";

// a detailed check from the model can take well over the default limit
// (and a failed run is retried once)
export const maxDuration = 300;

// The stored proposal (status + per-answer marks) — polled by the submission
// page while the automatic run that started on submission is still working.
export async function GET(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const url = new URL(req.url);
  const taskId = Number(url.searchParams.get("taskId"));
  const studentId = Number(url.searchParams.get("userId"));
  if (!Number.isInteger(taskId) || !Number.isInteger(studentId)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  await ensureGradeAssistColumns();
  const res = await db().execute({
    sql: `SELECT g.claude_status, g.claude_marks, g.claude_feedback, g.claude_error,
                 g.claude_submitted_at, p.submitted_at
          FROM grades g
          LEFT JOIN task_progress p ON p.task_id = g.task_id AND p.user_id = g.user_id
          WHERE g.task_id = ? AND g.user_id = ?`,
    args: [taskId, studentId],
  });
  const g = res.rows[0];
  return NextResponse.json({
    status: isCompletionStatus(g?.claude_status) ? g.claude_status : null,
    marks: parseMarks(g?.claude_marks ?? null),
    feedback: (g?.claude_feedback as string | null) ?? "",
    error: (g?.claude_error as string | null) ?? null,
    stale:
      g?.claude_submitted_at != null &&
      g?.submitted_at != null &&
      Number(g.claude_submitted_at) !== Number(g.submitted_at),
  });
}

// Teacher-triggered (re)run of the automatic check. Always answers with
// JSON — on failure { ok: false, error } so the panel can show it.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const studentId = Number(body?.userId);
  if (!Number.isInteger(taskId) || !Number.isInteger(studentId)) {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה." }, { status: 400 });
  }

  const result = await proposeGrade(taskId, studentId);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
