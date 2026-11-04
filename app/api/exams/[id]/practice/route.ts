import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import {
  buildMockExam,
  effectiveCards,
  effectiveOpenQuestions,
  getPracticeState,
  judgeQuiz,
  mockExamFeedback,
  openQuestionFeedback,
  practiceUnits,
  quizPool,
  quizRound,
  recordEvent,
} from "@/lib/practice";
import { OPEN_ANSWER_MAX, type QuizAnswer } from "@/lib/practice-types";
import { parseExamBody } from "@/lib/exam-types";
import { isEnglishStudent } from "@/lib/task-lang";

// Student practice actions (issue #34). Open only once the teacher opened the
// practice; teachers may always try it out. Nothing here is graded.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  const state = await getPracticeState(Number(id));
  if (!state || (state.openedAt == null && user.role !== "teacher")) {
    return NextResponse.json({ error: "התרגול עוד לא נפתח." }, { status: 404 });
  }
  const userId = Number(user.id);
  const examId = state.exam.id;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  const seconds = Number(body?.seconds) || 0;

  try {
    if (action === "quiz-round") {
      const pool = await quizPool(state.settings.units);
      const unit = String(body?.unit ?? "all");
      const only = Array.isArray(body?.only) ? body.only.map(String).slice(0, 50) : null;
      return NextResponse.json({ questions: quizRound(pool, unit, only) });
    }

    if (action === "quiz-answer") {
      const pool = await quizPool(state.settings.units);
      const item = pool.find((p) => p.id === String(body?.id ?? ""));
      const answer = body?.answer as QuizAnswer | undefined;
      if (!item || answer == null) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
      const verdict = judgeQuiz(item, answer);
      await recordEvent({ examId, userId, unitRef: item.unitRef, kind: "quiz", itemKey: item.id, correct: verdict.correct, seconds });
      return NextResponse.json(verdict);
    }

    if (action === "card") {
      const cards = await effectiveCards(state);
      const card = cards.find((c) => c.id === String(body?.id ?? ""));
      if (!card) return NextResponse.json({ error: "הכרטיס לא נמצא." }, { status: 400 });
      await recordEvent({ examId, userId, unitRef: card.unitRef, kind: "card", itemKey: card.id, correct: Boolean(body?.known), seconds });
      return NextResponse.json({ ok: true });
    }

    if (action === "open-feedback") {
      const qs = await effectiveOpenQuestions(state);
      const q = qs.find((x) => x.id === String(body?.questionId ?? ""));
      const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
      if (!q) return NextResponse.json({ error: "השאלה לא נמצאה." }, { status: 400 });
      if (answer.length < 2) return NextResponse.json({ error: "כתבו תשובה לפני שמבקשים משוב." }, { status: 400 });
      if (answer.length > OPEN_ANSWER_MAX) return NextResponse.json({ error: "התשובה ארוכה מדי." }, { status: 400 });
      const unit = practiceUnits([q.unitRef])[0];
      const feedback = await openQuestionFeedback(
        q.text,
        answer,
        [state.exam.title, unit ? `${unit.title} (${unit.chapters})` : ""].filter(Boolean).join(" · "),
        await isEnglishStudent(user)
      );
      await recordEvent({ examId, userId, unitRef: q.unitRef, kind: "open", itemKey: q.id, correct: null, seconds });
      return NextResponse.json({ feedback });
    }

    if (action === "mock-start") {
      const mock = await buildMockExam(state);
      if (!mock) return NextResponse.json({ error: "אין מספיק שאלות ביחידות כדי לבנות מבחן לדוגמה." }, { status: 400 });
      return NextResponse.json({ mock });
    }

    if (action === "mock-feedback") {
      const m = (body?.mock ?? {}) as Record<string, unknown>;
      const mockBody = parseExamBody(m.body);
      const raw = (body?.answers ?? {}) as Record<string, unknown>;
      const answers: Record<string, string> = {};
      for (const [k, v] of Object.entries(raw).slice(0, 60)) {
        if (typeof v === "string") answers[k.slice(0, 40)] = v.slice(0, OPEN_ANSWER_MAX);
      }
      const feedback = await mockExamFeedback(String(m.title ?? "מבחן לדוגמה").slice(0, 200), mockBody, answers, await isEnglishStudent(user));
      await recordEvent({ examId, userId, unitRef: "", kind: "mock", itemKey: "mock", correct: null, seconds });
      return NextResponse.json({ feedback });
    }
  } catch (err) {
    console.error("practice action failed", { action, examId, err });
    const msg =
      err instanceof Anthropic.APIError
        ? "המשוב האוטומטי לא זמין כרגע. נסו שוב בעוד רגע."
        : err instanceof Error && err.message
          ? err.message
          : "משהו השתבש. נסו שוב.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
}
