import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/api-auth";
import { approveExamScore, proposeExamScore, type PointsMap } from "@/lib/exam-grade";
import { getAttempt } from "@/lib/exams";

export const maxDuration = 300;

// Teacher: re-run the automatic proposal, or approve the final score.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const examId = Number(id);
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const userId = Number(body?.userId);
  const attempt = await getAttempt(examId, userId);
  if (!attempt) return NextResponse.json({ error: "ההגשה לא נמצאה." }, { status: 404 });

  if (body?.action === "propose") {
    const r = await proposeExamScore(examId, userId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 500 });
    const fresh = await getAttempt(examId, userId);
    return NextResponse.json({ ok: true, points: fresh?.claudePoints, feedback: fresh?.claudeFeedback });
  }

  if (body?.action === "approve") {
    const raw = (body.points ?? {}) as Record<string, { points?: unknown; note?: unknown }>;
    const points: PointsMap = {};
    for (const [k, v] of Object.entries(raw)) {
      points[k] = { points: Number(v?.points) || 0, note: String(v?.note ?? "") };
    }
    try {
      const score = await approveExamScore({
        examId,
        userId,
        points,
        feedback: String(body.feedback ?? ""),
      });
      revalidatePath(`/dashboard/exams/${examId}/submissions`);
      return NextResponse.json({ ok: true, score });
    } catch (e) {
      console.error("exam approve failed", e);
      return NextResponse.json({ error: "הציון לא נשמר. נסו שוב." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "פעולה לא מוכרת." }, { status: 400 });
}
