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
        { error: "המועד האחרון עבר — לתיקון אחרי המועד פנו למורה, שיכול/ה להחזיר את המשימה לעבודה." },
        { status: 400 }
      );
    }
    // a graded-and-approved submission is final for the student — otherwise
    // the approved grade would silently refer to edited work
    const approved = await db().execute({
      sql: "SELECT 1 FROM grades WHERE task_id = ? AND user_id = ? AND approved_at IS NOT NULL",
      args: [guard.task.id, guard.userId],
    });
    if (approved.rows.length > 0) {
      return NextResponse.json(
        { error: "המשימה כבר נבדקה ואושרה — לתיקון נוסף פנו למורה." },
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

  // Teacher notification: bell only — Reut asked not to be emailed on every
  // submission; the bell and in-site notifications are enough.
  const session = await auth();
  const name = session?.user?.fullName ?? session?.user?.email ?? "תלמידה";
  await notifyTeachers({
    kind: `submitted:${guard.task.id}:${guard.userId}:${t}`,
    title: `הגשה חדשה: ${name} הגיש/ה את ״${guard.task.title}״`,
    body: "אפשר לבדוק את ההגשה בדשבורד המורה.",
    link: `/dashboard/task/${guard.task.id}`,
    email: false,
  });

  return NextResponse.json({ ok: true, submitted: true });
}
