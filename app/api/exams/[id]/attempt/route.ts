import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import { saveAnswers, startAttempt, submitAttempt, getExam } from "@/lib/exams";
import { notifyTeachers } from "@/lib/notify";
import { proposeExamGrade } from "@/lib/exam-grade-assist";

// Leaves room for the after-response Claude proposal.
export const maxDuration = 300;

// Student side of an exam: start, autosave answers, submit.
// body: { action: "start" | "save" | "submit", answers? }
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  if (user.role === "teacher") {
    return NextResponse.json({ error: "מורים לא מגישים מבחן." }, { status: 403 });
  }
  const userId = Number(user.id);
  const examId = Number((await params).id);
  const body = await req.json().catch(() => null);
  const action = body?.action;
  const answers =
    body?.answers && typeof body.answers === "object" ? (body.answers as Record<string, string>) : null;

  if (action === "start") {
    const res = await startAttempt(examId, userId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "save") {
    if (!answers) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
    const res = await saveAnswers(examId, userId, answers);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }
  if (action === "submit") {
    const res = await submitAttempt(examId, userId, answers);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    const exam = await getExam(examId);
    const who = user.fullName ?? user.name ?? "תלמיד/ה";
    try {
      await notifyTeachers({
        kind: "submission",
        title: `הוגש מבחן: ${exam?.title ?? ""}`,
        body: who,
        link: `/dashboard/exams/${examId}/submissions/${res.attemptId}`,
      });
    } catch {
      // the submission itself already succeeded
    }
    // the automatic check runs after the response — the student is not kept waiting
    after(async () => {
      await proposeExamGrade(res.attemptId);
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
}
