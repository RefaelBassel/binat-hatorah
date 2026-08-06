import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now, ensureProgress } from "@/lib/tasks";

// Persist decode stage + progress percentage (done vs. remaining meter).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const stage = body?.stage != null ? Math.min(Math.max(1, Number(body.stage)), 8) : null;
  const pct =
    body?.progressPct != null
      ? Math.min(Math.max(0, Math.round(Number(body.progressPct))), 100)
      : null;

  await ensureProgress(guard.task.id, guard.userId);
  if (stage != null) {
    await db().execute({
      sql: "UPDATE task_progress SET stage = MAX(stage, ?), updated_at = ? WHERE task_id = ? AND user_id = ?",
      args: [stage, now(), guard.task.id, guard.userId],
    });
  }
  if (pct != null) {
    await db().execute({
      sql: "UPDATE task_progress SET progress_pct = ?, updated_at = ? WHERE task_id = ? AND user_id = ?",
      args: [pct, now(), guard.task.id, guard.userId],
    });
  }
  return NextResponse.json({ ok: true });
}
