"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FAILED = "הבדיקה האוטומטית נכשלה — נסי שוב.";

// Grading flow: Claude proposes score + feedback → the teacher edits →
// final approval sends the grade to the student (bell + email).
// The proposal is normally prepared on submission; if a submitted work has
// none yet (older submissions), it is requested as soon as the page opens.
export default function GradePanel({
  taskId,
  studentId,
  studentName,
  initialClaudeScore,
  initialClaudeFeedback,
  initialClaudeError,
  initialScore,
  initialFeedback,
  submitted,
  approved: initialApproved,
}: {
  taskId: number;
  studentId: number;
  studentName: string;
  initialClaudeScore: number | null;
  initialClaudeFeedback: string | null;
  initialClaudeError: string | null;
  initialScore: number | null;
  initialFeedback: string | null;
  submitted: boolean;
  approved: boolean;
}) {
  const [claudeScore, setClaudeScore] = useState(initialClaudeScore);
  const [claudeFeedback, setClaudeFeedback] = useState(initialClaudeFeedback);
  const [claudeError, setClaudeError] = useState(initialClaudeError);
  const [score, setScore] = useState<string>(
    initialScore != null ? String(initialScore) : ""
  );
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [approved, setApproved] = useState(initialApproved);
  const [busy, setBusy] = useState<"assist" | "save" | "approve" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // the teacher's own fields, read inside the async callback without
  // re-creating it on every keystroke
  const draft = useRef({ score, feedback });
  useEffect(() => {
    draft.current = { score, feedback };
  }, [score, feedback]);

  const askClaude = useCallback(async () => {
    setBusy("assist");
    setNote(null);
    setClaudeError(null);
    try {
      const res = await fetch("/api/grade-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId: studentId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setClaudeError(data?.error ?? FAILED);
      } else {
        setClaudeScore(data.score);
        setClaudeFeedback(data.feedback);
        if (!draft.current.score) setScore(data.score != null ? String(data.score) : "");
        if (!draft.current.feedback) setFeedback(data.feedback ?? "");
      }
    } catch {
      setClaudeError(`${FAILED} (בעיית חיבור.)`);
    } finally {
      setBusy(null);
    }
  }, [taskId, studentId]);

  // older submissions without a proposal: run the check once on open
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (submitted && !initialApproved && !initialClaudeFeedback && !initialClaudeError) {
      void askClaude();
    }
  }, [submitted, initialApproved, initialClaudeFeedback, initialClaudeError, askClaude]);

  const save = async (approve: boolean) => {
    setBusy(approve ? "approve" : "save");
    setNote(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: studentId,
          score: Number(score),
          feedback,
          approve,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (approve) {
          setApproved(true);
          setNote(`✅ הציון אושר ונשלח ל${studentName} במייל ובפעמון.`);
        } else {
          setNote("נשמר כטיוטה (טרם נשלח לתלמידה).");
        }
      } else setNote(data.error ?? "שגיאה בשמירה.");
    } catch {
      setNote("שגיאה בחיבור — נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <h2 className="mb-4 font-display text-base font-bold text-[color:var(--primary)]">
        🏅 בדיקה וציון {approved && <span className="text-[color:var(--success)]">· אושר ✓</span>}
      </h2>

      {/* Claude's proposal */}
      <div className="mb-4 rounded-xl bg-[color:var(--primary)]/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-[color:var(--primary)]">✨ ההצעה של קלוד</p>
          <button
            onClick={askClaude}
            disabled={busy !== null}
            className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "assist" ? "קלוד בודק..." : claudeFeedback ? "בדיקה מחדש" : "בקשת הצעת ציון והערכה"}
          </button>
        </div>
        {claudeError && busy !== "assist" && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2"
          >
            <p className="text-sm font-semibold text-[color:var(--danger)]">⚠️ {claudeError}</p>
            <button
              onClick={askClaude}
              disabled={busy !== null}
              className="shrink-0 rounded-full border-2 border-[color:var(--danger)]/60 px-4 py-1 text-xs font-bold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10 disabled:opacity-50"
            >
              נסי שוב
            </button>
          </div>
        )}
        {busy === "assist" && !claudeFeedback ? (
          <p className="text-xs text-[color:var(--primary)]/70">
            ⏳ קלוד בודק את ההגשה ומכין הצעת ציון והערכה — זה יכול לקחת עד דקה.
          </p>
        ) : claudeScore != null || claudeFeedback ? (
          <>
            {claudeScore != null && (
              <p className="text-sm font-bold text-[color:var(--primary)]">
                ציון מוצע: {claudeScore}
              </p>
            )}
            {claudeFeedback && (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[color:var(--foreground)]/80">
                {claudeFeedback}
              </p>
            )}
          </>
        ) : claudeError ? null : (
          <p className="text-xs text-[color:var(--primary)]/50">
            קלוד יציע ציון והערכה — המורה עורך/ת ומאשר/ת סופית.
          </p>
        )}
      </div>

      {/* teacher's final */}
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            ציון סופי
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-center text-lg font-bold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            הערכה מילולית (נשלחת לתלמיד/ה)
          </span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(false)}
          disabled={busy !== null || !score}
          className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-40"
        >
          {busy === "save" ? "שומרים..." : "שמירת טיוטה"}
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy !== null || !score}
          className="rounded-full bg-[color:var(--success)] px-6 py-2 text-sm font-bold text-white shadow disabled:opacity-40"
        >
          {busy === "approve" ? "שולחים..." : "אישור סופי ושליחה לתלמיד/ה 📨"}
        </button>
        {note && <p className="text-xs text-[color:var(--primary)]/70">{note}</p>}
      </div>
    </section>
  );
}
