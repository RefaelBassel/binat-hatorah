import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function clampAxis(v: unknown): number {
  return Math.min(2, Math.max(-2, Math.round(Number(v))));
}

// Audience vote: 4 axes in the argument-skill language, each a slider
// between the two groups (-2 = group A much stronger ... +2 = group B).
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const questionId = Number(body?.questionId);
  if (!Number.isInteger(questionId)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const q = await db().execute({
    sql: "SELECT votes_open FROM debate_questions WHERE id = ?",
    args: [questionId],
  });
  if (!q.rows[0] || !Number(q.rows[0].votes_open)) {
    return NextResponse.json({ error: "ההצבעה סגורה." }, { status: 400 });
  }

  await db().execute({
    sql: `INSERT INTO debate_votes
            (question_id, voter_id, ax_reasons, ax_assumptions, ax_logic, ax_rebuttal, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(question_id, voter_id) DO UPDATE SET
            ax_reasons = excluded.ax_reasons,
            ax_assumptions = excluded.ax_assumptions,
            ax_logic = excluded.ax_logic,
            ax_rebuttal = excluded.ax_rebuttal`,
    args: [
      questionId,
      Number(user.id),
      clampAxis(body?.reasons),
      clampAxis(body?.assumptions),
      clampAxis(body?.logic),
      clampAxis(body?.rebuttal),
      now(),
    ],
  });
  return NextResponse.json({ ok: true });
}
