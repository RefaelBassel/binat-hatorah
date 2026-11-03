import { NextResponse, after } from "next/server";
import { auth } from "@/auth";
import {
  examBodyOf,
  getAttempt,
  getDoc,
  now,
  saveAnswers,
  startAttempt,
  submitAttempt,
} from "@/lib/exams";
import { answerItems } from "@/lib/exam-types";
import { notifyTeachers } from "@/lib/notify";
import { proposeExamScore } from "@/lib/exam-grade";

export const maxDuration = 300;

// answers arriving up to this long after the deadline still count (network lag)
const GRACE = 90;

// Student: start the exam, autosave answers, submit.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const userId = Number(user.id);
  const { id } = await params;
  const exam = await getDoc(Number(id));
  if (!exam || exam.kind !== "exam" || exam.publishedAt == null) {
    return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
  }
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const t = now();

  if (action === "start") {
    if (exam.opensAt != null && t < exam.opensAt) {
      return NextResponse.json({ error: "המבחן עוד לא נפתח." }, { status: 400 });
    }
    const a = await startAttempt(exam.id, userId, exam.durationMin ?? 90);
    return NextResponse.json({ ok: true, startedAt: a.startedAt, deadlineAt: a.deadlineAt, answers: a.answers });
  }

  const attempt = await getAttempt(exam.id, userId);
  if (!attempt) return NextResponse.json({ error: "המבחן עוד לא התחיל." }, { status: 400 });
  if (attempt.submittedAt != null) {
    return NextResponse.json({ error: "המבחן כבר הוגש." }, { status: 400 });
  }

  if (action === "save" || action === "submit") {
    const raw = body?.answers;
    if (raw && typeof raw === "object" && t <= attempt.deadlineAt + GRACE) {
      const keys = new Set(answerItems(examBodyOf(exam)).map((it) => it.key));
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
        if (keys.has(k)) clean[k] = String(v ?? "").slice(0, 20000);
      }
      await saveAnswers(exam.id, userId, clean);
    } else if (action === "save") {
      return NextResponse.json({ error: "הזמן נגמר. התשובות שנשמרו עד עכשיו יוגשו." }, { status: 400 });
    }
  }

  if (action === "save") return NextResponse.json({ ok: true, savedAt: t });

  if (action === "submit") {
    await submitAttempt(exam.id, userId);
    const name = user.fullName ?? user.email ?? "תלמידה";
    await notifyTeachers({
      kind: `exam-submitted:${exam.id}:${userId}:${t}`,
      title: `הגשת מבחן: ${name} הגיש/ה את ״${exam.title}״`,
      body: "אפשר לבדוק את ההגשה באזור המבחנים בדשבורד.",
      link: `/dashboard/exams/${exam.id}/submissions/${userId}`,
    }).catch((e) => console.error("exam submit notify failed", e));
    after(() => proposeExamScore(exam.id, userId).then(() => undefined));
    return NextResponse.json({ ok: true, submittedAt: t });
  }

  return NextResponse.json({ error: "פעולה לא מוכרת." }, { status: 400 });
}
