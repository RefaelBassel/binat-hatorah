import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now, ensureProgress } from "@/lib/tasks";

// Work-stopwatch heartbeat. The client sends the seconds elapsed since the
// previous beat while the window was visible; we clamp each delta so a stuck
// client can't inflate the counter.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const delta = Math.min(Math.max(0, Math.floor(Number(body?.seconds ?? 0))), 60);

  await ensureProgress(guard.task.id, guard.userId);
  await db().execute({
    sql: `UPDATE task_progress SET work_seconds = work_seconds + ?, updated_at = ?
          WHERE task_id = ? AND user_id = ?`,
    args: [delta, now(), guard.task.id, guard.userId],
  });
  const res = await db().execute({
    sql: "SELECT work_seconds FROM task_progress WHERE task_id = ? AND user_id = ?",
    args: [guard.task.id, guard.userId],
  });
  return NextResponse.json({
    ok: true,
    workSeconds: Number(res.rows[0]?.work_seconds ?? 0),
  });
}
