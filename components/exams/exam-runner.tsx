"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type ExamBody, fmtPoints, partLabel, questionNumbers, questionPoints, subLabel } from "@/lib/exam-types";
import { pointsText } from "./doc-view";

interface AttemptInfo {
  startedAt: number;
  deadlineAt: number;
  submittedAt: number | null;
  answers: Record<string, string>;
  approved: boolean;
  score: number | null;
  feedback: string | null;
  points: Record<string, { points: number; note: string }> | null;
}

type SavePhase = "saved" | "pending" | "saving" | "error";

// The student's exam: opens at the set time, a countdown from the moment she
// starts, answers saved automatically, submitted by her or when time is up.
export default function ExamRunner({
  examId,
  durationMin,
  opensAt,
  body,
  items,
  serverNow,
  guest,
  attempt: initial,
}: {
  examId: number;
  title: string;
  durationMin: number;
  opensAt: number | null;
  body: ExamBody;
  items: { key: string; maxPoints: number }[];
  serverNow: number;
  guest: boolean;
  attempt: AttemptInfo | null;
}) {
  const router = useRouter();
  const [offset] = useState(() => serverNow - Math.floor(Date.now() / 1000));
  const [clock, setClock] = useState(serverNow);
  const [attempt, setAttempt] = useState<AttemptInfo | null>(initial);
  const [answers, setAnswers] = useState<Record<string, string>>(initial?.answers ?? {});
  const [save, setSave] = useState<SavePhase>("saved");
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const dirty = useRef(false);
  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    const t = window.setInterval(() => setClock(Math.floor(Date.now() / 1000) + offset), 1000);
    return () => window.clearInterval(t);
  }, [offset]);

  const inProgress = attempt != null && attempt.submittedAt == null;
  const remaining = attempt ? attempt.deadlineAt - clock : 0;

  const post = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch(`/api/exams/${examId}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "שגיאה");
      return data;
    },
    [examId]
  );

  const saveNow = useCallback(async () => {
    if (!dirty.current) return;
    dirty.current = false;
    setSave("saving");
    try {
      await post({ action: "save", answers: answersRef.current });
      setSave(dirty.current ? "pending" : "saved");
    } catch {
      dirty.current = true;
      setSave("error");
    }
  }, [post]);

  // autosave 1.5s after typing stops
  useEffect(() => {
    if (!inProgress || !dirty.current) return;
    const t = window.setTimeout(saveNow, 1500);
    return () => window.clearTimeout(t);
  }, [answers, inProgress, saveNow]);

  const submit = useCallback(
    async (auto: boolean) => {
      if (submitting) return;
      if (!auto && !window.confirm("להגיש את המבחן? אחרי ההגשה אי אפשר לשנות תשובות.")) return;
      setSubmitting(true);
      setErr(null);
      try {
        const data = await post({ action: "submit", answers: answersRef.current });
        dirty.current = false;
        setAttempt((a) => (a ? { ...a, submittedAt: data.submittedAt } : a));
        router.refresh();
      } catch (e) {
        setErr(e instanceof Error ? e.message : "ההגשה נכשלה. נסו שוב.");
      }
      setSubmitting(false);
    },
    [post, router, submitting]
  );

  // time's up → submit what she has
  const autoSent = useRef(false);
  useEffect(() => {
    if (inProgress && remaining <= 0 && !autoSent.current) {
      autoSent.current = true;
      submit(true);
    }
  }, [inProgress, remaining, submit]);

  useEffect(() => {
    if (!inProgress) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [inProgress]);

  const nums = questionNumbers(body);
  const maxOf = new Map(items.map((i) => [i.key, i.maxPoints]));

  // ── before start ──
  if (!attempt) {
    if (opensAt && clock < opensAt) {
      const d = new Date(opensAt * 1000).toLocaleString("he-IL", {
        weekday: "long",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jerusalem",
      });
      return (
        <Panel>
          <p className="text-lg font-bold">המבחן ייפתח {d}</p>
          <p className="mt-1 text-sm">זמן המבחן: {durationMin} דקות מרגע ההתחלה.</p>
        </Panel>
      );
    }
    return (
      <Panel>
        <p className="text-lg font-bold">המבחן פתוח</p>
        <p className="mt-1 text-sm">
          זמן המבחן: {durationMin} דקות. הטיימר מתחיל ברגע הלחיצה על ״התחלת המבחן״ ולא נעצר. התשובות נשמרות אוטומטית, וכשהזמן נגמר המבחן מוגש מעצמו.
        </p>
        {guest ? (
          <p className="mt-3 text-sm font-semibold">כדי לגשת למבחן יש להתחבר עם חשבון Google.</p>
        ) : (
          <button
            type="button"
            disabled={starting}
            onClick={async () => {
              if (!window.confirm(`להתחיל את המבחן? יש לך ${durationMin} דקות.`)) return;
              setStarting(true);
              setErr(null);
              try {
                const data = await post({ action: "start" });
                setAttempt({
                  startedAt: data.startedAt,
                  deadlineAt: data.deadlineAt,
                  submittedAt: null,
                  answers: data.answers ?? {},
                  approved: false,
                  score: null,
                  feedback: null,
                  points: null,
                });
                setAnswers(data.answers ?? {});
              } catch (e) {
                setErr(e instanceof Error ? e.message : "לא הצליח. נסו שוב.");
              }
              setStarting(false);
            }}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-fill)] px-6 py-2.5 font-bold text-white shadow transition hover:scale-[1.03] disabled:scale-[0.96] disabled:opacity-80"
          >
            {starting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {starting ? "פותח…" : "התחלת המבחן"}
          </button>
        )}
        {err && <p className="mt-2 text-sm font-semibold text-[color:var(--danger)]">{err}</p>}
      </Panel>
    );
  }

  const done = attempt.submittedAt != null;
  const mm = Math.max(0, Math.floor(remaining / 60));
  const ss = Math.max(0, remaining % 60);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {!done ? (
        <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/95 p-3 shadow-md backdrop-blur">
          <span
            className={`rounded-full px-4 py-1.5 font-mono text-lg font-bold tabular-nums ${
              remaining <= 300 ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]" : "bg-[color:var(--primary)]/10 text-[color:var(--primary)]"
            }`}
            aria-live="off"
          >
            ⏱ {String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
          </span>
          <span className="text-xs font-semibold">
            {save === "saving"
              ? "שומר…"
              : save === "pending"
                ? "● יש שינויים, נשמרים בעוד רגע"
                : save === "error"
                  ? <span className="text-[color:var(--danger)]">✕ לא נשמר, בדקו את החיבור</span>
                  : <span className="text-[color:var(--success)]">✓ התשובות שמורות</span>}
          </span>
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit(false)}
            className="inline-flex items-center gap-2 rounded-full bg-[color:var(--success-fill)] px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.03] disabled:scale-[0.96] disabled:opacity-80"
          >
            {submitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {submitting ? "מגיש…" : "הגשת המבחן"}
          </button>
          {err && <p className="w-full text-sm font-semibold text-[color:var(--danger)]">{err}</p>}
        </div>
      ) : (
        <Panel>
          {attempt.approved ? (
            <>
              <p className="text-lg font-bold">המבחן נבדק</p>
              <p className="mt-1 font-display text-4xl font-extrabold text-[color:var(--primary)]">{attempt.score}</p>
              {attempt.feedback && <p className="mt-3 whitespace-pre-wrap text-sm">{attempt.feedback}</p>}
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-[color:var(--success)]">✓ המבחן הוגש</p>
              <p className="mt-1 text-sm">הציון יופיע כאן אחרי שהמורה תבדוק.</p>
            </>
          )}
        </Panel>
      )}

      {body.parts.map((p, pi) => (
        <section key={p.id} className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
          <div>
            <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">
              {partLabel(pi)}
              {p.title ? `: ${p.title}` : ""}
              {p.points != null && ` (${pointsText(p.points)})`}
            </h2>
            {p.instructions && <p className="mt-1 whitespace-pre-wrap text-sm font-semibold">{p.instructions}</p>}
          </div>
          {p.questions.map((q) => (
            <div key={q.id} className="space-y-2">
              <p className="whitespace-pre-wrap">
                <span className="font-bold">{nums.get(q.id)}. </span>
                {p.choose == null && questionPoints(q) > 0 && <span className="font-semibold">({pointsText(questionPoints(q))}) </span>}
                {q.text}
              </p>
              {q.subs.length === 0 ? (
                <AnswerBox
                  k={q.id}
                  value={answers[q.id] ?? ""}
                  readOnly={done}
                  max={maxOf.get(q.id)}
                  result={attempt.points?.[q.id]}
                  onChange={(v) => {
                    dirty.current = true;
                    setSave("pending");
                    setAnswers((a) => ({ ...a, [q.id]: v }));
                  }}
                />
              ) : (
                <div className="space-y-3 ps-4">
                  {q.subs.map((s, si) => {
                    const k = `${q.id}:${s.id}`;
                    return (
                      <div key={s.id} className="space-y-1">
                        <p className="whitespace-pre-wrap">
                          <span className="font-semibold">{subLabel(si)} </span>
                          {s.text}
                          {s.points != null && <span className="text-sm"> ({pointsText(s.points)})</span>}
                        </p>
                        <AnswerBox
                          k={k}
                          value={answers[k] ?? ""}
                          readOnly={done}
                          max={maxOf.get(k)}
                          result={attempt.points?.[k]}
                          onChange={(v) => {
                            dirty.current = true;
                            setSave("pending");
                            setAnswers((a) => ({ ...a, [k]: v }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
              {q.footer?.trim() && <p className="whitespace-pre-wrap text-sm font-semibold">{q.footer}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center shadow-sm">
      {children}
    </div>
  );
}

function AnswerBox({
  k,
  value,
  readOnly,
  max,
  result,
  onChange,
}: {
  k: string;
  value: string;
  readOnly: boolean;
  max?: number;
  result?: { points: number; note: string };
  onChange: (v: string) => void;
}) {
  const rows = Math.max(3, value.split("\n").length + Math.floor(value.length / 80));
  return (
    <div>
      <textarea
        id={`answer-${k}`}
        dir="rtl"
        lang="he"
        aria-label="תשובה"
        value={value}
        readOnly={readOnly}
        rows={rows}
        placeholder={readOnly ? "(לא נענה)" : "כתבו כאן את התשובה"}
        onChange={(e) => onChange(e.target.value)}
        className="w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 leading-7 outline-none focus:border-[color:var(--primary)] read-only:opacity-90"
      />
      {result && (
        <p className="text-sm">
          <span className="font-bold text-[color:var(--primary)]">
            {fmtPoints(result.points)} / {max != null ? fmtPoints(max) : "?"}
          </span>
          {result.note && <span> · {result.note}</span>}
        </p>
      )}
    </div>
  );
}
