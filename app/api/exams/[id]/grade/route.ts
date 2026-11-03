import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { getAttemptById, getExam, saveGrade } from "@/lib/exams";
import { proposeExamGrade } from "@/lib/exam-grade-assist";
import { notifyStudent } from "@/lib/notify";
import type { ExamDoc } from "@/lib/exams-types";

export const maxDuration = 300;

// Teacher only. body: { attemptId, action: "assist" | "save" | "approve", scores?, feedback? }
//   assist  — (re)run the automatic check against the rubric
//   save    — keep the teacher's draft numbers, student sees nothing yet
//   approve — final: the student gets the score + feedback (bell + email)
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const examId = Number((await params).id);
  const body = await req.json().catch(() => null);
  const attemptId = Number(body?.attemptId);
  const attempt = await getAttemptById(attemptId);
  if (!attempt || attempt.examId !== examId) {
    return NextResponse.json({ error: "ההגשה לא נמצאה." }, { status: 404 });
  }

  if (body.action === "assist") {
    const res = await proposeExamGrade(attemptId);
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "save" || body.action === "approve") {
    const exam = await getExam(examId);
    if (!exam || exam.kind !== "exam") {
      return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
    }
    const approve = body.action === "approve";
    const res = await saveGrade(
      attemptId,
      exam.doc as ExamDoc,
      body.scores && typeof body.scores === "object" ? body.scores : {},
      typeof body.feedback === "string" ? body.feedback : "",
      approve
    );
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    if (approve) {
      try {
        await notifyStudent(attempt.userId, {
          kind: "grade",
          title: `הציון על ${exam.title} התקבל`,
          body: `הציון: ${res.score}`,
          link: `/exams/take/${examId}`,
        });
      } catch {
        // the grade itself is saved; a failed email must not undo it
      }
    }
    return NextResponse.json({ ok: true, score: res.score });
  }
  return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
}
