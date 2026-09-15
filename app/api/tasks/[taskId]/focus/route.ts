import { NextResponse } from "next/server";
import { requireStudentTask } from "@/lib/api-auth";
import { recordFocusEvents } from "@/lib/tasks";

// Focus-mode event reporting from the task page: window exits (with the
// time spent away) and blocked external pastes. Students only — a teacher
// walking through a task must not pollute the class focus picture.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;
  if (guard.isTeacher) return NextResponse.json({ ok: true, skipped: true });

  const body = await req.json().catch(() => null);
  const events = Array.isArray(body?.events)
    ? body.events
        .filter(
          (e: { kind?: string }) =>
            e?.kind === "blur" || e?.kind === "paste-blocked"
        )
        .map((e: { kind: string; awayMs?: unknown }) => ({
          kind: e.kind as "blur" | "paste-blocked",
          awayMs: Number(e.awayMs) || 0,
        }))
    : [];
  if (events.length === 0) return NextResponse.json({ ok: true });

  await recordFocusEvents(guard.task.id, guard.userId, events);
  return NextResponse.json({ ok: true });
}
