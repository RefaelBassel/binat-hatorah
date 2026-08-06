import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getDebate,
  getQuestions,
  questionResults,
  DEBATE_STAGES,
  now,
} from "@/lib/debate";

// Live state for the projected board + voting phones. Polled every ~1.5s.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const { debateId } = await params;
  const debate = await getDebate(Number(debateId));
  if (!debate) return NextResponse.json({ error: "לא נמצא." }, { status: 404 });
  const questions = await getQuestions(debate.id);

  // Remaining seconds for the current stage.
  const stage = DEBATE_STAGES[debate.currentStage] ?? null;
  let remaining: number | null = null;
  if (stage) {
    if (debate.stageStartedAt != null) {
      const base = debate.stageRemaining ?? stage.seconds;
      remaining = Math.max(0, base - (now() - debate.stageStartedAt));
    } else {
      remaining = debate.stageRemaining ?? stage.seconds;
    }
  }

  // Results for done/voting questions.
  const results: Record<number, Awaited<ReturnType<typeof questionResults>>> = {};
  for (const q of questions) {
    if (q.done || q.votesOpen) results[q.id] = await questionResults(q.id);
  }

  return NextResponse.json({
    debate,
    questions,
    stages: DEBATE_STAGES,
    remaining,
    running: debate.stageStartedAt != null,
    results,
    serverTime: now(),
  });
}
