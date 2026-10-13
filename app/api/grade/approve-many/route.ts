import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { approveGrade, ensureGradeAssistColumns } from "@/lib/grade-assist";
import { salvageGradeProposal } from "@/lib/grade-utils";

// Bulk approval of reviewed proposals on one task. For each student the
// teacher's saved draft wins; otherwise Claude's proposal is approved as is.
// Submissions without a score to approve are skipped and reported back.
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
      sql: `SELECT g.score, g.feedback, g.claude_score, g.claude_feedback, g.approved_at, p.submitted_at
            FROM grades g
            LEFT JOIN task_progress p ON p.task_id = g.task_id AND p.user_id = g.user_id
            WHERE g.task_id = ? AND g.user_id = ?`,
      args: [taskId, studentId],
    });
    const g = res.rows[0];
    if (!g || g.approved_at != null || g.submitted_at == null) {
      skipped += 1;
      continue;
    }
    const proposal =
      g.claude_feedback != null
        ? salvageGradeProposal(
            String(g.claude_feedback),
            g.claude_score != null ? Number(g.claude_score) : null
          )
        : null;
    const score = g.score != null ? Number(g.score) : proposal?.score ?? null;
    const feedback =
      g.feedback != null && String(g.feedback).trim()
        ? String(g.feedback)
        : proposal?.feedback ?? "";
    if (score == null) {
      skipped += 1;
      continue;
    }
    await approveGrade({ taskId, studentId, score, feedback, teacherId: guard.userId });
    approved += 1;
  }
  return NextResponse.json({ ok: true, approved, skipped });
}
