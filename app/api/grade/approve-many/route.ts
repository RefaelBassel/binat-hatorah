import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { approveGrade, ensureGradeAssistColumns, hasFreshProposal } from "@/lib/grade-assist";
import { isCompletionStatus, parseMarks } from "@/lib/completion";
import { salvageGradeProposal } from "@/lib/grade-utils";

// Bulk approval of reviewed proposals on one task. For each student the
// teacher's saved draft (status + marks) wins; otherwise the automatic
// proposal is approved as is. Work without a status to approve is skipped
// and reported back.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const userIds: number[] = Array.isArray(body?.userIds)
    ? body.userIds.map(Number).filter((n: number) => Number.isInteger(n))
    : [];
  if (!Number.isInteger(taskId) || userIds.length === 0) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  await ensureGradeAssistColumns();
  let approved = 0;
  let skipped = 0;
  for (const studentId of userIds) {
    const res = await db().execute({
      sql: `SELECT g.status, g.marks, g.feedback, g.claude_status, g.claude_marks, g.claude_feedback,
                   g.claude_submitted_at, g.approved_at, g.status_approved_at, p.submitted_at
            FROM grades g
            LEFT JOIN task_progress p ON p.task_id = g.task_id AND p.user_id = g.user_id
            WHERE g.task_id = ? AND g.user_id = ?`,
      args: [taskId, studentId],
    });
    const g = res.rows[0];
    if (!g || g.status_approved_at != null || (g.submitted_at == null && g.approved_at == null)) {
      skipped += 1;
      continue;
    }
    const draft = isCompletionStatus(g.status);
    const fresh = hasFreshProposal(g) && isCompletionStatus(g.claude_status);
    if (!draft && !fresh) {
      skipped += 1;
      continue;
    }
    const status = draft ? g.status : g.claude_status;
    const marks = parseMarks(draft ? g.marks : g.claude_marks);
    const feedback =
      g.feedback != null && String(g.feedback).trim()
        ? salvageGradeProposal(String(g.feedback), null).feedback
        : String(g.claude_feedback ?? "");
    if (!isCompletionStatus(status)) {
      skipped += 1;
      continue;
    }
    await approveGrade({ taskId, studentId, status, marks, feedback, teacherId: guard.userId });
    approved += 1;
  }
  return NextResponse.json({ ok: true, approved, skipped });
}
