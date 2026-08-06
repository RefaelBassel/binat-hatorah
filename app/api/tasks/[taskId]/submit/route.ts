import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now, ensureProgress } from "@/lib/tasks";
import { notifyTeachers } from "@/lib/notify";
import { auth } from "@/auth";

// Submit or un-submit. Un-submit ("ביטול הגשה ותיקון") is allowed until the
// task's final due date.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const action = body?.action === "unsubmit" ? "unsubmit" : "submit";
  const t = now();

  await ensureProgress(guard.task.id, guard.userId);

  if (action === "unsubmit") {
    if (t > guard.task.due_at) {
      return NextResponse.json(
        { error: "המועד האחרון עבר — לא ניתן לבטל הגשה." },
        { status: 400 }
      );
    }
    await db().execute({
      sql: "UPDATE task_progress SET submitted_at = NULL, updated_at = ? WHERE task_id = ? AND user_id = ?",
      args: [t, guard.task.id, guard.userId],
    });
    return NextResponse.json({ ok: true, submitted: false });
  }

  await db().execute({
    sql: "UPDATE task_progress SET submitted_at = ?, updated_at = ? WHERE task_id = ? AND user_id = ?",
    args: [t, t, guard.task.id, guard.userId],
  });

  // Teacher notification: bell + email.
  const session = await auth();
  const name = session?.user?.fullName ?? session?.user?.email ?? "תלמידה";
  await notifyTeachers({
    kind: `submitted:${guard.task.id}:${guard.userId}:${t}`,
    title: `הגשה חדשה: ${name} הגיש/ה את ״${guard.task.title}״`,
    body: "אפשר לבדוק את ההגשה בדשבורד המורה.",
    link: `/dashboard/task/${guard.task.id}`,
  });

  return NextResponse.json({ ok: true, submitted: true });
}
