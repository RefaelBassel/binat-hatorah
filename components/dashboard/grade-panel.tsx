"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ANSWER_MARKS,
  COMPLETION_META,
  COMPLETION_STATUSES,
  MARK_META,
  relevantCount,
  statusFromCounts,
  type AnswerMark,
  type CompletionStatus,
  type Marks,
} from "@/lib/completion-meta";

const FAILED = "הבדיקה האוטומטית נכשלה — נסי שוב.";
// how long the run started on submission gets before the page runs it itself
const BACKGROUND_GRACE = 300;
const POLL_MS = 15_000;

export interface ReviewQuestion {
  key: string;
  section: string;
  label: string;
  prompt: string;
  answer: string;
}

export interface Proposal {
  status: CompletionStatus;
  marks: Marks;
  feedback: string;
}

// Review flow (#24): the automatic check proposes a completion status and a
// mark + note beside every answer → the teacher changes whatever she wants →
// approval returns it to the student (bell + email). Until then it is a draft
// only the teacher sees. No numeric score anywhere. While the background run
// is still working the panel polls for it; if it never arrives, the page runs
// the check itself.
export default function GradePanel({
  taskId,
  studentId,
  studentName,
  questions,
  initialProposal,
  initialClaudeError,
  initialStale,
  initialDraft,
  needsReview,
  submittedAt,
  approved: initialApproved,
  nextPendingHref,
}: {
  taskId: number;
  studentId: number;
  studentName: string;
  questions: ReviewQuestion[];
  initialProposal: Proposal | null;
  initialClaudeError: string | null;
  initialStale: boolean;
  initialDraft: { status: CompletionStatus | null; marks: Marks; feedback: string };
  needsReview: boolean;
  submittedAt: number | null;
  approved: boolean;
  nextPendingHref: string | null;
}) {
  const answers = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.key, q.answer])),
    [questions]
  );
  const computeStatus = useCallback(
    (m: Marks) => statusFromCounts(relevantCount(questions, answers, m), questions.length),
    [questions, answers]
  );

  const [proposal, setProposal] = useState<Proposal | null>(initialProposal);
  const [claudeError, setClaudeError] = useState(initialClaudeError);
  const [stale, setStale] = useState(initialStale);

  // a saved teacher draft wins; otherwise the fields start from the proposal
  const hasDraft = initialDraft.status != null;
  const startMarks = hasDraft
    ? initialDraft.marks
    : initialProposal && !initialStale
      ? initialProposal.marks
      : {};
  const [marks, setMarks] = useState<Marks>(startMarks);
  const [status, setStatus] = useState<CompletionStatus>(
    initialDraft.status ?? computeStatus(startMarks)
  );
  // once the teacher picks a status herself, the marks no longer move it
  const [statusManual, setStatusManual] = useState(
    hasDraft && initialDraft.status !== computeStatus(initialDraft.marks)
  );
  const [feedback, setFeedback] = useState(
    initialDraft.feedback.trim()
      ? initialDraft.feedback
      : initialProposal && !initialStale
        ? initialProposal.feedback
        : ""
  );
  const [approved, setApproved] = useState(initialApproved);
  const [busy, setBusy] = useState<"assist" | "save" | "approve" | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);
  // true while the fields still hold the proposal untouched — a fresh
  // proposal may then replace them; once the teacher edits, it never does
  const fieldsFromProposal = useRef(!hasDraft);
  const feedbackFromProposal = useRef(!initialDraft.feedback.trim());

  const applyProposal = useCallback(
    (p: Proposal) => {
      setProposal(p);
      setStale(false);
      setClaudeError(null);
      if (fieldsFromProposal.current) {
        setMarks(p.marks);
        setStatus(computeStatus(p.marks));
        setStatusManual(false);
      }
      if (feedbackFromProposal.current) setFeedback(p.feedback);
    },
    [computeStatus]
  );

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
        applyProposal({ status: data.status, marks: data.marks ?? {}, feedback: data.feedback ?? "" });
      }
    } catch {
      setClaudeError(`${FAILED} (בעיית חיבור.)`);
    } finally {
      setBusy(null);
    }
  }, [taskId, studentId, applyProposal]);

  // waiting for the automatic proposal: poll the stored one; past the grace
  // period (the background run died — or this is older work being moved to
  // the new method) run the check from here, once
  const waiting =
    needsReview && !approved && (!proposal || stale) && !claudeError && busy !== "assist";
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
        if (data.status && !data.stale) {
          applyProposal({ status: data.status, marks: data.marks ?? {}, feedback: data.feedback ?? "" });
        } else if (data.error) setClaudeError(data.error);
      } catch {
        // try again on the next tick
      }
    };
    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => window.clearInterval(id);
  }, [waiting, submittedAt, taskId, studentId, askClaude, applyProposal]);

  const touch = () => {
    fieldsFromProposal.current = false;
    setDirty(true);
    setNote(null);
  };

  const updateMarks = (next: Marks) => {
    touch();
    setMarks(next);
    if (!statusManual) setStatus(computeStatus(next));
  };
  const setMark = (key: string, mark: AnswerMark) =>
    updateMarks({ ...marks, [key]: { mark, note: marks[key]?.note ?? "" } });
  const clearMark = (key: string) => {
    const next = { ...marks };
    delete next[key];
    updateMarks(next);
  };
  const setMarkNote = (key: string, text: string) => {
    touch();
    setMarks((prev) => (prev[key] ? { ...prev, [key]: { ...prev[key], note: text } } : prev));
  };

  const save = async (approve: boolean) => {
    setBusy(approve ? "approve" : "save");
    setNote(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId: studentId, status, marks, feedback, approve }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        fieldsFromProposal.current = false;
        feedbackFromProposal.current = false;
        setDirty(false);
        if (approve) {
          setApproved(true);
          setNote({ ok: true, text: `✅ אושר והוחזר ל${studentName} במייל ובפעמון.` });
        } else {
          setNote({ ok: true, text: "✅ נשמר כטיוטה (התלמיד/ה עדיין לא רואה)." });
        }
      } else setNote({ ok: false, text: data?.error ?? "שגיאה בשמירה — נסי שוב." });
    } catch {
      setNote({ ok: false, text: "שגיאה בחיבור — נסו שוב." });
    } finally {
      setBusy(null);
    }
  };

  const hasProposal = proposal != null && !stale;
  const relevant = relevantCount(questions, answers, marks);
  const autoStatus = statusFromCounts(relevant, questions.length);
  const sections = [...new Set(questions.map((q) => q.section))];

  return (
    <section className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-[color:var(--primary)]">
          🏅 בדיקה: סימון התשובות וסטטוס ביצוע
        </h2>
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

      {/* the automatic proposal */}
      <div className="mb-5 rounded-xl bg-[color:var(--primary)]/5 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-[color:var(--primary)]">✨ הצעת הבדיקה האוטומטית</p>
          <button
            onClick={askClaude}
            disabled={busy !== null}
            className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "assist" ? "בודקים..." : proposal ? "בדיקה מחדש" : "בקשת הצעת בדיקה"}
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
        {(busy === "assist" || waiting) && (!proposal || stale) ? (
          <p className="text-xs text-[color:var(--primary)]/70">
            ⏳ הבדיקה האוטומטית עוברת על התשובות ומכינה סימון לכל תשובה וסטטוס ביצוע — זה יכול
            לקחת דקה או שתיים.
            {stale && " (ההצעה הקודמת נכתבה לפני שההגשה בוטלה והוגשה מחדש.)"}
          </p>
        ) : proposal ? (
          <>
            {stale && (
              <p className="mb-2 text-xs font-semibold text-[color:var(--warning)]">
                ההצעה הזו נכתבה להגשה קודמת — ההגשה בוטלה והוגשה מחדש.
              </p>
            )}
            <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[color:var(--primary)]">
              סטטוס מוצע:
              <StatusTag status={proposal.status} />
            </p>
            {proposal.feedback && (
              <p className="mt-2 whitespace-pre-wrap text-xs leading-6 text-[color:var(--foreground)]/80">
                {proposal.feedback}
              </p>
            )}
          </>
        ) : claudeError ? null : (
          <p className="text-xs text-[color:var(--primary)]/50">
            הבדיקה האוטומטית מציעה סימון לכל תשובה וסטטוס ביצוע — המורה משנה ומאשר/ת סופית.
          </p>
        )}
      </div>

      {/* every answer with its mark + note — editable */}
      {questions.length === 0 ? (
        <p className="mb-5 text-sm text-[color:var(--foreground)]/60">אין במשימה שאלות לסימון.</p>
      ) : (
        <div className="mb-5 space-y-5">
          {sections.map((sec) => (
            <div key={sec}>
              <h3 className="mb-2 text-xs font-bold text-[color:var(--accent)]">{sec}</h3>
              <div className="space-y-3">
                {questions
                  .filter((q) => q.section === sec)
                  .map((q) => {
                    const answered = q.answer.trim() !== "";
                    const m = marks[q.key];
                    const p = hasProposal ? proposal?.marks[q.key] : undefined;
                    const differs = p && (p.mark !== m?.mark || p.note !== (m?.note ?? ""));
                    return (
                      <div key={q.key} className="rounded-xl bg-[color:var(--background)] px-4 py-3">
                        <p className="text-xs font-semibold text-[color:var(--primary)]/65">{q.label}</p>
                        <p className="mb-1 text-xs text-[color:var(--foreground)]/60">{q.prompt}</p>
                        {answered ? (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                            {q.answer}
                          </p>
                        ) : (
                          <p className="text-sm text-[color:var(--danger)]/70">(לא נענתה)</p>
                        )}
                        {answered && (
                          <div className="mt-2 space-y-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                              {ANSWER_MARKS.map((k) => {
                                const meta = MARK_META[k];
                                const on = m?.mark === k;
                                return (
                                  <button
                                    key={k}
                                    type="button"
                                    aria-pressed={on}
                                    disabled={busy !== null}
                                    onClick={() => (on ? clearMark(q.key) : setMark(q.key, k))}
                                    className={`rounded-full border px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${
                                      on ? "border-transparent shadow-sm" : "border-[color:var(--border)] opacity-70 hover:opacity-100"
                                    }`}
                                    style={on ? { background: meta.bg, color: meta.color } : undefined}
                                  >
                                    {meta.symbol} {meta.label}
                                  </button>
                                );
                              })}
                            </div>
                            {m && (
                              <input
                                type="text"
                                value={m.note}
                                maxLength={600}
                                disabled={busy !== null}
                                onChange={(e) => setMarkNote(q.key, e.target.value)}
                                placeholder="הערה קצרה לתשובה (לא חובה)"
                                className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1.5 text-xs"
                              />
                            )}
                            {differs && p && (
                              <p className="text-[11px] text-[color:var(--foreground)]/50">
                                הצעת הבדיקה: {MARK_META[p.mark].symbol} {MARK_META[p.mark].label}
                                {p.note && ` · ${p.note}`}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* completion status — follows the marks unless the teacher picks one */}
      <div className="mb-4 rounded-xl border border-[color:var(--border)] p-4">
        <p className="mb-2 text-xs font-semibold text-[color:var(--primary)]/70">סטטוס ביצוע</p>
        <div className="flex flex-wrap items-center gap-2">
          {COMPLETION_STATUSES.map((s) => {
            const meta = COMPLETION_META[s];
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                disabled={busy !== null}
                onClick={() => {
                  touch();
                  setStatus(s);
                  setStatusManual(s !== autoStatus);
                }}
                className={`rounded-full border-2 px-4 py-1.5 text-sm font-bold transition disabled:opacity-50 ${
                  on ? "border-transparent shadow" : "border-[color:var(--border)] opacity-70 hover:opacity-100"
                }`}
                style={on ? { background: meta.bg, color: meta.color } : undefined}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-[color:var(--foreground)]/55">
          לפי הסימונים: {relevant} מתוך {questions.length} שאלות עם תשובה רלוונטית →{" "}
          {COMPLETION_META[autoStatus].label}
          {statusManual && (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => {
                  touch();
                  setStatus(autoStatus);
                  setStatusManual(false);
                }}
                className="font-semibold text-[color:var(--accent)] underline"
              >
                חזרה לסטטוס לפי הסימונים
              </button>
            </>
          )}
        </p>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
          הערה כללית (לא חובה · תוחזר לתלמיד/ה רק אחרי אישור)
        </span>
        <textarea
          value={feedback}
          onChange={(e) => {
            touch();
            feedbackFromProposal.current = false;
            setFeedback(e.target.value);
          }}
          rows={4}
          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2 text-sm leading-6"
        />
      </label>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(false)}
          disabled={busy !== null}
          className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-40"
        >
          {busy === "save" ? "שומרים..." : "שמירת טיוטה"}
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy !== null || (approved && !dirty)}
          className="rounded-full bg-[color:var(--success-fill)] px-6 py-2 text-sm font-bold text-white shadow disabled:opacity-40"
        >
          {busy === "approve"
            ? "שולחים..."
            : approved
              ? dirty
                ? "עדכון מה שאושר 📨"
                : "✓ אושר"
              : "אישור והחזרה לתלמיד/ה 📨"}
        </button>
        {dirty && !busy && !note && (
          <p className="text-xs text-[color:var(--warning)]">יש שינויים שלא נשמרו</p>
        )}
        {note && (
          <p
            className={`text-xs font-semibold ${
              note.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
            }`}
          >
            {note.text}
          </p>
        )}
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

function StatusTag({ status }: { status: CompletionStatus }) {
  const meta = COMPLETION_META[status];
  return (
    <span
      className="rounded-full px-3 py-0.5 text-xs font-bold"
      style={{ background: meta.bg, color: meta.color }}
    >
      {meta.label}
    </span>
  );
}
