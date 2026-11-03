"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { type AnswerItem, type ExamBody, partLabel, scoreFromItems } from "@/lib/exam-types";

type PointsMap = Record<string, { points: number; note: string }>;
type Phase = "idle" | "busy" | "done" | "error";

// Teacher grading of one exam attempt: the automatic proposal fills the
// points, the teacher edits and approves a numeric score.
export default function ExamGrader({
  examId,
  userId,
  body,
  items,
  answers,
  submitted,
  claudePoints,
  claudeFeedback,
  claudeError,
  approvedPoints,
  approvedFeedback,
  approvedScore,
}: {
  examId: number;
  userId: number;
  body: ExamBody;
  items: AnswerItem[];
  answers: Record<string, string>;
  submitted: boolean;
  claudePoints: PointsMap | null;
  claudeFeedback: string | null;
  claudeError: string | null;
  approvedPoints: PointsMap | null;
  approvedFeedback: string | null;
  approvedScore: number | null;
}) {
  const router = useRouter();
  const start = approvedPoints ?? claudePoints ?? {};
  const [points, setPoints] = useState<PointsMap>(start);
  const [feedback, setFeedback] = useState(approvedFeedback ?? claudeFeedback ?? "");
  const [propose, setPropose] = useState<Phase>("idle");
  const [approve, setApprove] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(claudeError);
  const [score, setScore] = useState<number | null>(approvedScore);

  const total = useMemo(() => {
    const flat: Record<string, number> = {};
    for (const [k, v] of Object.entries(points)) flat[k] = Number(v.points) || 0;
    return scoreFromItems(body, flat);
  }, [points, body]);

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch(`/api/exams/${examId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...payload }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "שגיאה");
    return data;
  };

  const partOf = new Map<string, number>();
  body.parts.forEach((p, i) => partOf.set(p.id, i));
  let lastPart = -1;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/95 p-3 shadow-md backdrop-blur">
        <span className="text-lg font-bold">
          ציון מחושב: <span className="text-[color:var(--primary)]">{total}</span>
          {score != null && <span className="ms-3 text-sm text-[color:var(--success)]">✓ אושר: {score}</span>}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={propose === "busy" || !submitted}
            onClick={async () => {
              setPropose("busy");
              setMsg(null);
              try {
                const data = await call({ action: "propose" });
                if (data.points) setPoints(data.points);
                if (data.feedback != null) setFeedback(data.feedback);
                setPropose("done");
                window.setTimeout(() => setPropose("idle"), 2000);
              } catch (e) {
                setPropose("error");
                setMsg(e instanceof Error ? e.message : "נכשל");
              }
            }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] disabled:opacity-60"
          >
            {propose === "busy" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
            {propose === "busy" ? "בודק… (עד דקה)" : propose === "done" ? "✓ הוצעה בדיקה חדשה" : claudePoints ? "הצעת ניקוד מחדש" : "הצעת ניקוד אוטומטית"}
          </button>
          <button
            type="button"
            disabled={approve === "busy" || !submitted}
            onClick={async () => {
              setApprove("busy");
              setMsg(null);
              try {
                const data = await call({ action: "approve", points, feedback });
                setScore(data.score);
                setApprove("done");
                router.refresh();
                window.setTimeout(() => setApprove("idle"), 2500);
              } catch (e) {
                setApprove("error");
                setMsg(e instanceof Error ? e.message : "לא נשמר");
              }
            }}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow transition ${
              approve === "done" ? "scale-[1.04] bg-[color:var(--success-fill)]" : "bg-[color:var(--accent-fill)] hover:scale-[1.03]"
            } disabled:opacity-60`}
          >
            {approve === "busy" && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {approve === "busy" ? "שומר…" : approve === "done" ? "✓ הציון אושר ונשלח" : score != null ? "עדכון הציון" : "אישור הציון ושליחה לתלמיד/ה"}
          </button>
        </div>
        {!submitted && <p className="w-full text-xs text-[color:var(--warning)]">המבחן עוד לא הוגש.</p>}
        {msg && <p className="w-full text-sm font-semibold text-[color:var(--danger)]">{msg}</p>}
        {!claudePoints && submitted && !claudeError && propose === "idle" && (
          <p className="w-full text-xs text-[color:var(--foreground)]/60">הצעת הניקוד האוטומטית בהכנה. רעננו בעוד דקה, או לחצו ״הצעת ניקוד אוטומטית״.</p>
        )}
      </div>

      {items.map((it) => {
        const pi = partOf.get(it.partId) ?? 0;
        const header = pi !== lastPart;
        lastPart = pi;
        const p = points[it.key] ?? { points: 0, note: "" };
        const proposal = claudePoints?.[it.key];
        return (
          <div key={it.key}>
            {header && (
              <h2 className="mb-2 mt-4 font-display text-lg font-bold text-[color:var(--primary)]">
                {partLabel(pi)}
                {body.parts[pi]?.title ? `: ${body.parts[pi].title}` : ""}
                {body.parts[pi]?.choose ? ` · ${body.parts[pi].choose} מתוך ${body.parts[pi].questions.length} (נספרות הטובות)` : ""}
              </h2>
            )}
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
              <p className="text-sm font-bold">{it.label}</p>
              {it.prompt !== it.questionText && <p className="text-xs text-[color:var(--foreground)]/60">{it.questionText}</p>}
              <p className="whitespace-pre-wrap text-sm">{it.prompt}</p>
              {it.rubric.trim() && (
                <p className="mt-1 whitespace-pre-wrap rounded-lg border-s-4 border-[color:var(--success)] bg-[color:var(--success)]/5 px-2 py-1 text-xs">
                  <span className="font-bold">מחוון: </span>
                  {it.rubric}
                </p>
              )}
              <div className="mt-2 whitespace-pre-wrap rounded-lg bg-[color:var(--background)] px-3 py-2 leading-7">
                {answers[it.key]?.trim() ? answers[it.key] : <span className="text-[color:var(--foreground)]/50">(לא נענה)</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1 text-sm font-semibold">
                  ניקוד
                  <input
                    type="number"
                    min={0}
                    max={it.maxPoints}
                    step={0.5}
                    value={p.points}
                    onChange={(e) =>
                      setPoints((m) => ({ ...m, [it.key]: { ...p, points: Math.max(0, Math.min(it.maxPoints, Number(e.target.value) || 0)) } }))
                    }
                    className="w-20 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1"
                  />
                  / {it.maxPoints}
                </label>
                {proposal && (
                  <span className="text-xs text-[color:var(--foreground)]/60">הצעה אוטומטית: {proposal.points}</span>
                )}
                <input
                  type="text"
                  dir="rtl"
                  aria-label="הערה"
                  placeholder="הערה לתלמיד/ה"
                  value={p.note}
                  onChange={(e) => setPoints((m) => ({ ...m, [it.key]: { ...p, note: e.target.value } }))}
                  className="min-w-48 flex-1 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        );
      })}

      <label className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-sm font-bold">
        הערה כללית לתלמיד/ה
        <textarea
          dir="rtl"
          rows={3}
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 font-normal"
        />
      </label>
    </div>
  );
}
