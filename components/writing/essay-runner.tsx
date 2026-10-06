"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { EssayExercise } from "@/content/writing/essays";
import { ESSAY_STEP_MINUTES, ESSAY_WORD_COUNT } from "@/content/writing/essays";
import type { TaskSection, QuestionBlock } from "@/content/tasks/types";

// The 40-minute argumentative-writing practice, as a task screen. One page,
// six steps top to bottom: read the text, take it apart, take a stand,
// build the case, meet the other side, write the paragraph. Every answer is
// an ordinary task answer (saved as you type), so the class pulse, the
// submission view and the grading see it like any Part-B answer. A soft
// timer and per-step minutes keep the pace; nothing is locked by time.

interface Props {
  taskId: number;
  exercise: EssayExercise;
  sections: TaskSection[];
  initialAnswers: Record<string, string>;
  submitted: boolean;
  dueAt: number;
  studentName: string | null;
  readOnly: boolean; // teacher outside student mode: looks, does not save
}

const STEPS = [
  { key: "read", emoji: "📖", title: "קוראים", minutes: ESSAY_STEP_MINUTES.read },
  { key: "analyze", emoji: "🧩", title: "מפרקים את הטיעון", minutes: ESSAY_STEP_MINUTES.analyze },
  { key: "stand", emoji: "📌", title: "העמדה שלי", minutes: ESSAY_STEP_MINUTES.stand },
  { key: "build", emoji: "🧱", title: "בונים את הטיעון", minutes: ESSAY_STEP_MINUTES.build },
  { key: "counter", emoji: "🥊", title: "הצד השני", minutes: ESSAY_STEP_MINUTES.counter },
  { key: "write", emoji: "✍️", title: "הפסקה השלמה", minutes: ESSAY_STEP_MINUTES.write },
] as const;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function EssayRunner({ taskId, exercise, sections, initialAnswers, submitted: initialSubmitted, dueAt, studentName, readOnly }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const locked = submitted || readOnly;

  // ---- the answer keys, in order, and progress ----
  const keys = useMemo(() => {
    const out: { key: string; label: string; step: string; block: QuestionBlock }[] = [];
    for (const s of sections) {
      for (const b of s.blocks) {
        if (b.type !== "question") continue;
        if (b.fields?.length) for (const f of b.fields) out.push({ key: `${b.key}:${f.key}`, label: f.label, step: s.key, block: b });
        else out.push({ key: b.key, label: b.label, step: s.key, block: b });
      }
    }
    return out;
  }, [sections]);
  const essayKey = "q-essay";
  const essayWords = ESSAY_WORD_COUNT(answers[essayKey] ?? "");
  const isDone = (k: string) => {
    const v = (answers[k] ?? "").trim();
    if (!v) return false;
    if (k === essayKey) return ESSAY_WORD_COUNT(v) >= exercise.minWords;
    return v.length >= 3;
  };
  const doneCount = keys.filter((k) => isDone(k.key)).length;
  const pct = Math.round((100 * doneCount) / Math.max(1, keys.length));
  const stepDone = (step: string) => keys.filter((k) => k.step === step).every((k) => isDone(k.key));

  // ---- persistence: answers (debounced), stage 8 + percentage, heartbeat ----
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const saveState = useCallback(
    (p: number) => {
      if (readOnly) return;
      fetch(`/api/tasks/${taskId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: 8, progressPct: p }),
      }).catch(() => {});
    },
    [taskId, readOnly]
  );
  useEffect(() => {
    saveState(pct);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setAnswer = (key: string, value: string) => {
    if (locked) return;
    setAnswers((a) => ({ ...a, [key]: value }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      fetch(`/api/tasks/${taskId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: key, answer: value }),
      })
        .then(() => {
          const next = { ...answers, [key]: value };
          const d = keys.filter((k) => {
            const v = (next[k.key] ?? "").trim();
            return k.key === essayKey ? ESSAY_WORD_COUNT(v) >= exercise.minWords : v.length >= 3;
          }).length;
          saveState(Math.round((100 * d) / Math.max(1, keys.length)));
        })
        .catch(() => {});
    }, 800);
  };

  // the work stopwatch: counts while the window is visible, beats every 20s
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    let since = Date.now();
    let acc = 0;
    const tick = setInterval(() => {
      if (document.visibilityState === "visible") {
        acc += 1;
        setElapsed((e) => e + 1);
      }
    }, 1000);
    const beat = setInterval(() => {
      if (readOnly || submitted || acc === 0) return;
      const seconds = acc;
      acc = 0;
      since = Date.now();
      void since;
      fetch(`/api/tasks/${taskId}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds }),
      }).catch(() => {});
    }, 20000);
    return () => {
      clearInterval(tick);
      clearInterval(beat);
    };
  }, [taskId, readOnly, submitted]);
  const total = exercise.minutes * 60;
  const over = elapsed > total;

  // ---- a small hint from Claude, per step ("לא פוגשים קיר") ----
  const [hint, setHint] = useState<{ step: string; text: string; loading: boolean } | null>(null);
  const askHint = async (step: (typeof STEPS)[number]) => {
    const mine = keys.filter((k) => k.step === step.key).map((k) => `${k.label}: ${answers[k.key]?.trim() || "(ריק)"}`).join("\n");
    setHint({ step: step.key, text: "", loading: true });
    try {
      const r = await fetch("/api/assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          context: `תרגול כתיבה טיעונית (לא על פרק בתנ"ך) — "${exercise.title}". השאלה: ${exercise.question}
השלב: ${step.title}. הטקסט שנקרא (תחילתו): ${exercise.source.paragraphs.slice(0, 2).join(" ").slice(0, 700)}…
מה שכתבתי עד כה בשלב הזה:
${mine}`,
          input: "נתקעתי בשלב הזה — רמז קטן שיזיז אותי, בלי לכתוב במקומי.",
        }),
      });
      const d = await r.json();
      setHint({ step: step.key, text: d.reply ?? "נסו לנסח לי מה בדיוק קשה.", loading: false });
    } catch {
      setHint({ step: step.key, text: "משהו השתבש בחיבור — נסו שוב עוד רגע.", loading: false });
    }
  };

  // ---- submit / un-submit ----
  const submit = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${taskId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "submit" }) });
      const d = await r.json();
      if (d.ok) {
        setSubmitted(true);
        setNotice("הוגש ✓ המורה תקבל את זה בדשבורד");
      } else setNotice(d.error ?? "ההגשה לא הצליחה");
    } finally {
      setBusy(false);
      window.setTimeout(() => setNotice(null), 3500);
    }
  };
  const unsubmit = async () => {
    setBusy(true);
    try {
      const r = await fetch(`/api/tasks/${taskId}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "unsubmit" }) });
      const d = await r.json();
      if (d.ok) setSubmitted(false);
      else setNotice(d.error ?? "אי אפשר לבטל את ההגשה");
    } finally {
      setBusy(false);
      window.setTimeout(() => setNotice(null), 4000);
    }
  };
  const canUnsubmit = Math.floor(Date.now() / 1000) <= dueAt;

  const field = (k: { key: string; label: string }, rows = 2, placeholder?: string) => (
    <label key={k.key} className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-bold text-[color:var(--primary)]/75">
        <span>{k.label}</span>
        {isDone(k.key) && <span className="text-[color:var(--success)]">✓</span>}
      </span>
      <textarea
        value={answers[k.key] ?? ""}
        onChange={(e) => setAnswer(k.key, e.target.value)}
        disabled={locked}
        rows={rows}
        placeholder={placeholder ?? "כתבו כאן…"}
        className="w-full rounded-xl border border-[color:var(--border)] bg-white px-3 py-2 text-[15px] leading-7 outline-none transition focus:border-[color:var(--accent)] disabled:bg-[color:var(--background)]"
      />
    </label>
  );
  const keysOf = (step: string) => keys.filter((k) => k.step === step);

  return (
    <div className="space-y-6" dir="rtl">
      {/* ---- the pace bar: steps, timer, progress ---- */}
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-[color:var(--border)] px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6" style={{ background: "color-mix(in srgb, var(--card) 92%, transparent)" }}>
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1.5">
          <ol className="flex flex-wrap items-center gap-1">
            {STEPS.map((s, i) => {
              const done = s.key === "read" ? elapsed >= 60 : stepDone(s.key);
              return (
                <li key={s.key}>
                  <a
                    href={`#step-${s.key}`}
                    className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold transition ${done ? "border-[color:var(--success)] bg-[color:var(--success)]/10 text-[color:var(--success)]" : "border-[color:var(--border)] text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]"}`}
                    title={`${s.title} · ~${s.minutes} דק׳`}
                  >
                    <span>{done ? "✓" : i + 1}</span>
                    <span aria-hidden>{s.emoji}</span>
                    <span className="hidden sm:inline">{s.title}</span>
                  </a>
                </li>
              );
            })}
          </ol>
          <span className="ms-auto flex items-center gap-2 text-xs font-bold">
            <span className={`rounded-full px-2.5 py-0.5 ${over ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]" : "bg-[color:var(--background)] text-[color:var(--primary)]/70"}`} title="זמן עבודה מצטבר מול הזמן המומלץ">
              ⏱ {fmt(elapsed)} / {exercise.minutes}:00
            </span>
            <span className="rounded-full bg-[color:var(--accent)]/15 px-2.5 py-0.5 text-[color:var(--accent)]">{pct}%</span>
          </span>
        </div>
      </div>

      {notice && (
        <div className="note-pop pointer-events-none fixed inset-x-0 bottom-24 z-[96] flex justify-center px-4">
          <p className="rounded-full bg-[color:var(--ink,#2e2438)] px-4 py-2 text-xs font-bold text-white shadow-xl">{notice}</p>
        </div>
      )}

      {/* ---- 1. the text ---- */}
      <section id="step-read" className="scroll-mt-28 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[0]} />
        <p className="mb-4 rounded-xl bg-[color:var(--accent)]/10 px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]/85">
          ❓ <b>השאלה שתצטרכו לענות עליה בסוף:</b> {exercise.question}
          <br />
          <span className="text-[color:var(--foreground)]/65">בזמן הקריאה שימו לב: מה הכותב/ת רוצה לשכנע אתכם, ובמה.</span>
        </p>
        <article className="rounded-2xl bg-[color:var(--background)] px-5 py-5 sm:px-8 sm:py-7">
          <h2 className="font-display text-2xl font-extrabold leading-snug text-[color:var(--primary)]">{exercise.source.title}</h2>
          <p className="mb-5 mt-1 text-xs text-[color:var(--primary)]/55">{exercise.source.byline}</p>
          <div className="space-y-4 text-[17px] leading-8 text-[color:var(--foreground)]/90">
            {exercise.source.paragraphs.map((p, i) => (
              <p key={i}>
                <span className="me-2 inline-block rounded-full bg-[color:var(--primary)]/8 px-2 text-[11px] font-bold text-[color:var(--primary)]/60 align-middle">{i + 1}</span>
                {p}
              </p>
            ))}
          </div>
        </article>
      </section>

      {/* ---- 2. analyze ---- */}
      <section id="step-analyze" className="scroll-mt-28 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[1]} />
        <p className="mb-3 text-sm text-[color:var(--foreground)]/70">מה הטקסט טוען? נסחו במילים שלכם, לא בציטוט. הטיפים מתחת לכל שדה מכוונים לאן להסתכל.</p>
        <div className="space-y-3">
          {keysOf("analyze").map((k) => (
            <div key={k.key}>
              {field(k)}
              <p className="mt-1 text-[11px] leading-5 text-[color:var(--primary)]/55">💡 {k.key.endsWith(":claim") ? exercise.analysisHints.claim : k.key.endsWith(":reasons") ? exercise.analysisHints.reasons : exercise.analysisHints.assumption}</p>
            </div>
          ))}
        </div>
        <HintBox step={STEPS[1]} hint={hint} ask={askHint} locked={locked} />
      </section>

      {/* ---- 3. stand ---- */}
      <section id="step-stand" className="scroll-mt-28 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[2]} />
        <p className="mb-3 text-sm font-semibold text-[color:var(--foreground)]/85">{exercise.question}</p>
        <div className="mb-3 grid gap-2 sm:grid-cols-3">
          {exercise.stands.map((s) => {
            const on = (answers["q-stand:stand"] ?? "") === s;
            return (
              <button
                key={s}
                type="button"
                disabled={locked}
                onClick={() => setAnswer("q-stand:stand", s)}
                className={`rounded-2xl border-2 px-3 py-2.5 text-start text-sm font-semibold transition active:scale-[0.98] disabled:cursor-default ${on ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow" : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:border-[color:var(--accent)]"}`}
              >
                {on ? "✓ " : ""}{s}
              </button>
            );
          })}
        </div>
        {field({ key: "q-stand:claim", label: "📌 הטענה שלי במשפט אחד — ברור, בלי ״אולי״" }, 2, "אני חושב/ת ש…")}
        <HintBox step={STEPS[2]} hint={hint} ask={askHint} locked={locked} />
      </section>

      {/* ---- 4. build ---- */}
      <section id="step-build" className="scroll-mt-28 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[3]} />
        <p className="mb-3 text-sm text-[color:var(--foreground)]/70">שני נימוקים, ולכל טענה ראיה: אחת מהטקסט ואחת מהחיים. נימוק עונה על ״למה?״; ראיה עונה על ״מאיפה אתם יודעים?״.</p>
        <div className="space-y-3">
          {keysOf("build").map((k) => (
            <div key={k.key}>
              {field(k, k.key.endsWith("evidenceText") || k.key.endsWith("evidenceLife") ? 3 : 2)}
              {k.key.endsWith("evidenceLife") && <p className="mt-1 text-[11px] leading-5 text-[color:var(--primary)]/55">💡 {exercise.lifeHint}</p>}
              {k.key.endsWith("evidenceText") && <p className="mt-1 text-[11px] leading-5 text-[color:var(--primary)]/55">💡 חזרו לטקסט למעלה. העתיקו משפט קצר במירכאות, ואז כתבו מה הוא מוכיח לטובתכם, או איפה הוא חלש.</p>}
            </div>
          ))}
        </div>
        <HintBox step={STEPS[3]} hint={hint} ask={askHint} locked={locked} />
      </section>

      {/* ---- 5. counter ---- */}
      <section id="step-counter" className="scroll-mt-28 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[4]} />
        <p className="mb-3 text-sm text-[color:var(--foreground)]/70">טיעון חזק לא מתעלם מהצד השני. הוא מציג אותו בחוזקו, ואז עונה.</p>
        <p className="mb-3 text-[11px] leading-5 text-[color:var(--primary)]/55">💡 {exercise.counterHint}</p>
        <div className="space-y-3">{keysOf("counter").map((k) => field(k))}</div>
        <HintBox step={STEPS[4]} hint={hint} ask={askHint} locked={locked} />
      </section>

      {/* ---- 6. write ---- */}
      <section id="step-write" className="scroll-mt-28 rounded-3xl border-2 border-[color:var(--accent)]/60 bg-[color:var(--card)] p-5 sm:p-7">
        <StepHead step={STEPS[5]} />
        <p className="mb-2 text-sm text-[color:var(--foreground)]/80">עכשיו מחברים הכול לפסקה אחת רציפה, לפחות {exercise.minWords} מילים. אפשר להעתיק מהשלבים הקודמים, אבל הפסקה צריכה לזרום כמו טקסט אחד.</p>
        <ol className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-bold">
          {["פתיחה: הטענה", "נימוק 1 + ראיה", "נימוק 2 + ראיה", "הצד השני ותשובה", "סיום שחוזר לטענה"].map((s, i) => (
            <li key={s} className="rounded-full bg-[color:var(--background)] px-2.5 py-1 text-[color:var(--primary)]/70">{i + 1}. {s}</li>
          ))}
        </ol>
        <textarea
          value={answers[essayKey] ?? ""}
          onChange={(e) => setAnswer(essayKey, e.target.value)}
          disabled={locked}
          rows={10}
          placeholder="הפסקה שלי…"
          className="w-full rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-[16px] leading-8 outline-none transition focus:border-[color:var(--accent)] disabled:bg-[color:var(--background)]"
        />
        <div className="mt-1 flex items-center justify-between text-xs font-bold">
          <span className={essayWords >= exercise.minWords ? "text-[color:var(--success)]" : "text-[color:var(--primary)]/60"}>
            {essayWords} מילים {essayWords >= exercise.minWords ? "✓" : `· עוד ${exercise.minWords - essayWords} לפחות`}
          </span>
        </div>
        <HintBox step={STEPS[5]} hint={hint} ask={askHint} locked={locked} />
      </section>

      {/* ---- submit ---- */}
      <section className="rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 text-center sm:p-6">
        {submitted ? (
          <>
            <p className="font-display text-xl font-extrabold text-[color:var(--success)]">הוגש ✓</p>
            <p className="mt-1 text-sm text-[color:var(--foreground)]/70">{studentName ? `${studentName}, ` : ""}המשוב של המורה יגיע אליך כאן ובפעמון.</p>
            {canUnsubmit && !readOnly && (
              <button type="button" disabled={busy} onClick={unsubmit} className="mt-3 rounded-full border border-[color:var(--border)] px-5 py-1.5 text-xs font-bold text-[color:var(--primary)] active:scale-95 disabled:opacity-40">
                ביטול הגשה ותיקון
              </button>
            )}
          </>
        ) : (
          <>
            <p className="text-sm text-[color:var(--foreground)]/70">
              {doneCount}/{keys.length} שדות מולאו{essayWords < exercise.minWords ? ` · הפסקה עוד קצרה (${essayWords}/${exercise.minWords} מילים)` : ""}
            </p>
            <button
              type="button"
              disabled={busy || readOnly || doneCount < keys.length}
              onClick={submit}
              className={`mt-3 rounded-full px-8 py-3 text-base font-extrabold text-white shadow-lg transition hover:scale-[1.03] active:scale-95 disabled:opacity-40 disabled:hover:scale-100 ${busy ? "animate-pulse" : ""}`}
              style={{ background: "var(--accent)" }}
              title={doneCount < keys.length ? "אפשר להגיש כשכל השלבים מולאו" : undefined}
            >
              {busy ? "שולחים…" : "הגשת התרגול ✨"}
            </button>
            {readOnly && <p className="mt-2 text-[11px] text-[color:var(--primary)]/50">תצוגת מורה — כדי לנסות כמו תלמידה, עברו למצב תלמיד.</p>}
          </>
        )}
      </section>
    </div>
  );
}

function StepHead({ step }: { step: (typeof STEPS)[number] }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--primary)] text-xl">{step.emoji}</span>
      <h2 className="font-display text-xl font-extrabold text-[color:var(--primary)]">{step.title}</h2>
      <span className="ms-auto rounded-full bg-[color:var(--background)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--primary)]/60">~{step.minutes} דק׳</span>
    </div>
  );
}

function HintBox({ step, hint, ask, locked }: { step: (typeof STEPS)[number]; hint: { step: string; text: string; loading: boolean } | null; ask: (s: (typeof STEPS)[number]) => void; locked: boolean }) {
  if (locked) return null;
  const mine = hint?.step === step.key ? hint : null;
  return (
    <div className="mt-3">
      <button type="button" onClick={() => ask(step)} disabled={!!mine?.loading} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-[11px] font-bold text-[color:var(--primary)]/70 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-50">
        {mine?.loading ? "חושב…" : "✨ נתקעתי — רמז קטן מקלוד"}
      </button>
      {mine && !mine.loading && <p className="note-pop mt-2 rounded-xl bg-[color:var(--primary)]/5 px-3 py-2 text-sm leading-6 text-[color:var(--foreground)]/85">{mine.text}</p>}
    </div>
  );
}
