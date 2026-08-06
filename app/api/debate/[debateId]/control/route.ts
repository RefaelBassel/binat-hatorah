import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getDebate, getQuestions, DEBATE_STAGES, now } from "@/lib/debate";

// Teacher remote control: start debate, run/pause stage timer, move between
// stages and questions, open/close voting, finish.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const { debateId } = await params;
  const debate = await getDebate(Number(debateId));
  if (!debate) return NextResponse.json({ error: "לא נמצא." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const action = String(body?.action ?? "");
  const t = now();
  const questions = await getQuestions(debate.id);

  const setStage = async (stageIdx: number, autoStart = true) => {
    const stage = DEBATE_STAGES[stageIdx];
    await db().execute({
      sql: `UPDATE debates SET current_stage = ?, stage_started_at = ?, stage_remaining = ? WHERE id = ?`,
      args: [stageIdx, autoStart ? t : null, stage.seconds, debate.id],
    });
  };

  switch (action) {
    case "start": {
      const first = questions.find((q) => !q.done) ?? questions[0];
      if (!first) return NextResponse.json({ error: "אין שאלות." }, { status: 400 });
      await db().execute({
        sql: "UPDATE debates SET status = 'live', current_question_id = ? WHERE id = ?",
        args: [first.id, debate.id],
      });
      await setStage(0);
      break;
    }
    case "pause": {
      if (debate.stageStartedAt != null) {
        const stage = DEBATE_STAGES[debate.currentStage];
        const base = debate.stageRemaining ?? stage.seconds;
        const left = Math.max(0, base - (t - debate.stageStartedAt));
        await db().execute({
          sql: "UPDATE debates SET stage_started_at = NULL, stage_remaining = ? WHERE id = ?",
          args: [left, debate.id],
        });
      }
      break;
    }
    case "resume": {
      await db().execute({
        sql: "UPDATE debates SET stage_started_at = ? WHERE id = ?",
        args: [t, debate.id],
      });
      break;
    }
    case "next-stage": {
      const next = Math.min(debate.currentStage + 1, DEBATE_STAGES.length - 1);
      await setStage(next);
      // Entering the vote stage opens voting automatically.
      if (DEBATE_STAGES[next].key === "vote" && debate.currentQuestionId) {
        await db().execute({
          sql: "UPDATE debate_questions SET votes_open = 1 WHERE id = ?",
          args: [debate.currentQuestionId],
        });
      }
      break;
    }
    case "prev-stage": {
      await setStage(Math.max(debate.currentStage - 1, 0));
      break;
    }
    case "close-votes": {
      if (debate.currentQuestionId) {
        await db().execute({
          sql: "UPDATE debate_questions SET votes_open = 0, done = 1 WHERE id = ?",
          args: [debate.currentQuestionId],
        });
      }
      break;
    }
    case "next-question": {
      // Close current, move to the next undone question, reset to stage 0.
      if (debate.currentQuestionId) {
        await db().execute({
          sql: "UPDATE debate_questions SET votes_open = 0, done = 1 WHERE id = ?",
          args: [debate.currentQuestionId],
        });
      }
      const fresh = await getQuestions(debate.id);
      const next = fresh.find((q) => !q.done);
      if (next) {
        await db().execute({
          sql: "UPDATE debates SET current_question_id = ? WHERE id = ?",
          args: [next.id, debate.id],
        });
        await setStage(0);
      } else {
        await db().execute({
          sql: "UPDATE debates SET status = 'done', stage_started_at = NULL WHERE id = ?",
          args: [debate.id],
        });
      }
      break;
    }
    case "finish": {
      if (debate.currentQuestionId) {
        await db().execute({
          sql: "UPDATE debate_questions SET votes_open = 0, done = 1 WHERE id = ?",
          args: [debate.currentQuestionId],
        });
      }
      await db().execute({
        sql: "UPDATE debates SET status = 'done', stage_started_at = NULL WHERE id = ?",
        args: [debate.id],
      });
      break;
    }
    default:
      return NextResponse.json({ error: "פעולה לא מוכרת." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
