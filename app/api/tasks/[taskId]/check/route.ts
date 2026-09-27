import { NextResponse } from "next/server";
import { requireStudentTask } from "@/lib/api-auth";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "@/lib/content-overrides";
import {
  getCheckResult,
  saveCheckResult,
  scoreCheck,
  type CheckSubmission,
} from "@/lib/check";

// The comprehension check: the student's one attempt is scored here against
// the effective content (file defaults + teacher edits). Teachers walking
// through a task get their score back but nothing is stored — the class
// picture stays students-only.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const reg = getTaskContent(guard.task.content_ref);
  if (!reg) return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  const content = await effectiveContent(reg.content);
  const questions = content.check ?? [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "למשימה זו אין בדיקת הבנה." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const rawAnswers = (body?.answers ?? {}) as Record<string, unknown>;
  const given: CheckSubmission = {};
  for (const q of questions) {
    const v = rawAnswers[q.key];
    if (q.kind === "order") {
      if (Array.isArray(v)) given[q.key] = v.map((x) => String(x));
    } else if (typeof v === "number" && Number.isInteger(v)) {
      given[q.key] = v;
    }
  }
  // every closed question must be answered — the number is only "certain"
  // when nothing was skipped
  const missing = questions.filter((q) => given[q.key] === undefined);
  if (missing.length > 0) {
    return NextResponse.json(
      { error: "צריך לענות על כל השאלות לפני הבדיקה.", missing: missing.map((q) => q.key) },
      { status: 400 }
    );
  }
  const openAnswer =
    typeof body?.openAnswer === "string"
      ? body.openAnswer.trim().slice(0, 2000) || null
      : null;

  if (guard.isTeacher) {
    return NextResponse.json({ ok: true, preview: true, ...scoreCheck(questions, given) });
  }
  const outcome = await saveCheckResult(
    guard.task.id,
    guard.userId,
    questions,
    given,
    openAnswer
  );
  if (!outcome) {
    const existing = await getCheckResult(guard.task.id, guard.userId);
    return NextResponse.json({ error: "בדיקת ההבנה כבר הוגשה.", existing }, { status: 409 });
  }
  return NextResponse.json({ ok: true, ...outcome });
}
