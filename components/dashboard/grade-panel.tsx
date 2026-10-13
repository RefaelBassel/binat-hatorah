"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

const FAILED = "הבדיקה האוטומטית נכשלה — נסי שוב.";
// how long the run started on submission gets before the page runs it itself
const BACKGROUND_GRACE = 300;
const POLL_MS = 15_000;

// Grading flow: Claude's proposal is prepared automatically on submission
// and pre-fills the editable score + feedback → the teacher edits → approval
// returns the grade to the student (bell + email). Until then it is a draft
// only the teacher sees. While the background run is still working the panel
// polls for it; if it never arrives, the page runs the check itself.
export default function GradePanel({
  taskId,
  studentId,
  studentName,
  initialClaudeScore,
  initialClaudeFeedback,
  initialClaudeError,
  initialStale,
  initialScore,
  initialFeedback,
  submitted,
  submittedAt,
  approved: initialApproved,
  nextPendingHref,
}: {
  taskId: number;
  studentId: number;
  studentName: string;
  initialClaudeScore: number | null;
  initialClaudeFeedback: string | null;
  initialClaudeError: string | null;
  initialStale: boolean;
  initialScore: number | null;
  initialFeedback: string | null;
  submitted: boolean;
  submittedAt: number | null;
  approved: boolean;
  nextPendingHref: string | null;
}) {
  const [claudeScore, setClaudeScore] = useState(initialClaudeScore);
  const [claudeFeedback, setClaudeFeedback] = useState(initialClaudeFeedback);
  const [claudeError, setClaudeError] = useState(initialClaudeError);
  const [stale, setStale] = useState(initialStale);
  // no teacher draft yet → the fields start from Claude's proposal
  const hasDraft = initialScore != null || Boolean(initialFeedback?.trim());
  const [score, setScore] = useState<string>(
    initialScore != null
      ? String(initialScore)
      : !initialStale && initialClaudeScore != null
        ? String(initialClaudeScore)
        : ""
  );
  const [feedback, setFeedback] = useState(
    hasDraft ? (initialFeedback ?? "") : !initialStale ? (initialClaudeFeedback ?? "") : ""
  );
  const [approved, setApproved] = useState(initialApproved);
  const [busy, setBusy] = useState<"assist" | "save" | "approve" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // true while the fields still hold Claude's text untouched — a fresh
  // proposal may then replace them; once the teacher edits, it never does
  const fieldsFromProposal = useRef(!hasDraft);

  const applyProposal = useCallback((s: number | null, f: string) => {
    setClaudeScore(s);
    setClaudeFeedback(f);
    setStale(false);
    setClaudeError(null);
    if (fieldsFromProposal.current) {
      setScore(s != null ? String(s) : "");
      setFeedback(f);
    }
  }, []);

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
        applyProposal(data.score, data.feedback ?? "");
      }
    } catch {
      setClaudeError(`${FAILED} (בעיית חיבור.)`);
    } finally {
      setBusy(null);
    }
  }, [taskId, studentId, applyProposal]);

  // waiting for the automatic proposal: poll the stored one; past the grace
  // period (the background run died) run the check from here, once
  const waiting =
    submitted && !approved && (!claudeFeedback || stale) && !claudeError && busy !== "assist";
  const selfRan = useRef(false);
  useEffect(() => {
    if (!waiting) return;
    const tick = async () => {
      const age = submittedAt != null ? Date.now() / 1000 - submittedAt : Infinity;
      if (age > BACKGROUND_GRACE) {
        if (!selfRan.current) {
          selfRan.current = true;
          void askClaude();
        }
        return;
      }
      try {
        const res = await fetch(`/api/grade-assist?taskId=${taskId}&userId=${studentId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return;
        if (data.feedback && !data.stale) applyProposal(data.score, data.feedback);
        else if (data.error) setClaudeError(data.error);
      } catch {
        // try again on the next tick
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [waiting, submittedAt, taskId, studentId, askClaude, applyProposal]);

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
        fieldsFromProposal.current = false;
        if (approve) {
          setApproved(true);
          setNote(`✅ הציון אושר והוחזר ל${studentName} במייל ובפעמון.`);
        } else {
          setNote("✅ נשמר כטיוטה (התלמיד/ה עדיין לא רואה).");
        }
      } else setNote(data.error ?? "שגיאה בשמירה.");
    } catch {
      setNote("שגיאה בחיבור — נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  const hasProposal = Boolean(claudeFeedback) && !stale;

  return (
    <section className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-[color:var(--primary)]">🏅 בדיקה וציון</h2>
        {approved ? (
          <span className="rounded-full bg-[color:var(--success)]/10 px-3 py-1 text-xs font-bold text-[color:var(--success)]">
            ✓ אושר והוחזר לתלמיד/ה
          </span>
        ) : hasProposal ? (
          <span className="rounded-full bg-[color:var(--warning)]/15 px-3 py-1 text-xs font-bold text-[color:var(--warning)]">
            ✨ הצעה ממתינה לאישור — התלמיד/ה עדיין לא רואה
          </span>
        ) : null}
      </div>

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
        {(busy === "assist" || waiting) && (!claudeFeedback || stale) ? (
          <p className="text-xs text-[color:var(--primary)]/70">
            ⏳ קלוד בודק את ההגשה ומכין הצעת ציון והערכה — זה יכול לקחת דקה או שתיים.
            {stale && " (ההצעה הקודמת נכתבה לפני שההגשה בוטלה והוגשה מחדש.)"}
          </p>
        ) : claudeScore != null || claudeFeedback ? (
          <>
            {stale && (
              <p className="mb-2 text-xs font-semibold text-[color:var(--warning)]">
                ההצעה הזו נכתבה להגשה קודמת — ההגשה בוטלה והוגשה מחדש.
              </p>
            )}
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
            קלוד מציע ציון והערכה לכל הגשה — המורה עורך/ת ומאשר/ת סופית.
          </p>
        )}
      </div>

      {/* teacher's final — pre-filled from the proposal, editable */}
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
            onChange={(e) => {
              fieldsFromProposal.current = false;
              setScore(e.target.value);
            }}
            className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-center text-lg font-bold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            הערכה מילולית (תוחזר לתלמיד/ה רק אחרי אישור)
          </span>
          <textarea
            value={feedback}
            onChange={(e) => {
              fieldsFromProposal.current = false;
              setFeedback(e.target.value);
            }}
            rows={8}
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
          {busy === "approve"
            ? "שולחים..."
            : approved
              ? "עדכון הציון שאושר 📨"
              : "אישור והחזרה לתלמיד/ה 📨"}
        </button>
        {note && <p className="text-xs text-[color:var(--primary)]/70">{note}</p>}
      </div>

      {nextPendingHref && (
        <div className="mt-4 border-t border-[color:var(--border)] pt-4 text-left">
          <Link
            href={nextPendingHref}
            className="inline-block rounded-full border-2 border-[color:var(--accent)]/60 px-4 py-1.5 text-xs font-bold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10"
          >
            להגשה הבאה שממתינה לאישור ←
          </Link>
        </div>
      )}
    </section>
  );
}
