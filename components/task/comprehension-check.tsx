"use client";

import type { AnswerGuard } from "./answer-guard";
import { useState } from "react";
import type { CheckOpenQuestion } from "@/content/tasks/types";
import type { CheckOutcome, PublicCheckQuestion } from "@/lib/check";

// The comprehension check as the student sees it (Part A, stage 7).
// Closed questions only reach the browser without their answer key; the
// server scores the ONE attempt and returns a 1-10 number plus which
// questions were wrong — never the correct answers, so nothing can be
// whispered to a neighbour. One open question at the end is "לגיוון": it
// is stored for the teacher but does not enter the number.
type Given = Record<string, number | string[]>;

export default function ComprehensionCheck({
  taskId,
  questions,
  open,
  initial,
  readOnly,
  preview,
  onResult,
  guard,
  stepped = false,
}: {
  taskId: number;
  questions: PublicCheckQuestion[];
  open?: CheckOpenQuestion;
  initial: CheckOutcome | null;
  readOnly: boolean;
  preview: boolean;
  onResult: (o: CheckOutcome) => void;
  guard?: AnswerGuard;
  // one question at a time with a summary before "לבדוק" (issue #21)
  stepped?: boolean;
}) {
  const [given, setGiven] = useState<Given>({});
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [openAnswer, setOpenAnswer] = useState("");
  const [result, setResult] = useState<CheckOutcome | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locked = readOnly || result != null;
  const answered = questions.filter((q) => {
    const g = given[q.key];
    return q.kind === "order"
      ? Array.isArray(g) && g.length === q.options.length
      : typeof g === "number";
  }).length;
  const ready = answered === questions.length && questions.length > 0;

  const submit = async () => {
    if (!ready || busy || locked) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: given, openAnswer }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.existing) {
        const ex = data.existing as {
          score: number;
          correct: number;
          total: number;
          results: Record<string, { correct: boolean }>;
        };
        const flat: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(ex.results)) flat[k] = v.correct;
        const o = { score: ex.score, correct: ex.correct, total: ex.total, results: flat };
        setResult(o);
        onResult(o);
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "משהו השתבש — נסו שוב");
        return;
      }
      const o: CheckOutcome = {
        score: data.score,
        correct: data.correct,
        total: data.total,
        results: data.results ?? {},
      };
      setResult(o);
      onResult(o);
    } catch {
      setError("אין חיבור — נסו שוב");
    } finally {
      setBusy(false);
    }
  };

  const questionCard = (q: PublicCheckQuestion, i: number) => {
        const verdict = result ? result.results[q.key] : undefined;
        return (
          <div
            key={q.key}
            className={`rounded-2xl border bg-[color:var(--card)] p-4 transition ${
              verdict === true
                ? "border-[color:var(--success)]/50"
                : verdict === false
                  ? "border-[color:var(--danger)]/45"
                  : "border-[color:var(--border)]"
            }`}
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <p className="text-xs font-bold text-[color:var(--accent)]">
                שאלה {i + 1} ·{" "}
                {q.kind === "choice"
                  ? "בחרו תשובה אחת"
                  : q.kind === "truefalse"
                    ? "נכון או לא נכון?"
                    : "סדרו לפי הפרק — לחצו לפי הסדר"}
              </p>
              {verdict === true && (
                <span className="rounded-full bg-[color:var(--success)]/12 px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--success)]">
                  ✓ נכון
                </span>
              )}
              {verdict === false && (
                <span className="rounded-full bg-[color:var(--danger)]/12 px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--danger)]">
                  ✗ לא מדויק
                </span>
              )}
            </div>
            <p className="q-text mb-3 text-sm font-semibold leading-7 text-[color:var(--foreground)]">
              {q.prompt}
            </p>
            {q.kind === "order" ? (
              <OrderPicker
                options={q.options}
                value={Array.isArray(given[q.key]) ? (given[q.key] as string[]) : []}
                onChange={(v) => setGiven((g) => ({ ...g, [q.key]: v }))}
                locked={locked}
              />
            ) : (
              <div className="space-y-1.5">
                {q.options.map((opt, idx) => {
                  const sel = given[q.key] === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={locked}
                      onClick={() => setGiven((g) => ({ ...g, [q.key]: idx }))}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-start text-sm transition ${
                        sel
                          ? "border-[color:var(--accent)] bg-[color:var(--accent)]/8 font-semibold"
                          : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--accent)]/50"
                      } disabled:cursor-default`}
                    >
                      <span
                        aria-hidden
                        className={`h-4 w-4 shrink-0 rounded-full border-2 ${
                          sel
                            ? "border-[color:var(--accent)] bg-[color:var(--accent)]"
                            : "border-[color:var(--border)]"
                        }`}
                      />
                      {opt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
  };

  const openCard = open && (
        <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <p className="mb-1 text-xs font-bold text-[color:var(--primary)]/60">
            שאלה פתוחה · לגיוון — לא נכנסת למספר
          </p>
          <p className="q-text mb-2 text-sm font-semibold leading-7">{open.prompt}</p>
          <textarea
            value={openAnswer}
            onChange={(e) => {
              const next = e.target.value;
              setOpenAnswer((prev) => (guard ? guard.filterChange(prev, next) : next));
            }}
            disabled={locked}
            rows={2}
            placeholder="במילים שלכם…"
            className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)] disabled:opacity-70"
          />
        </div>
  );

  const resultOrSubmit = (
    <>
      {result ? (
        <div className="check-pop flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/8 px-5 py-4">
          <div>
            <p className="font-display text-2xl font-extrabold text-[color:var(--success)]">
              ההבנה שלך: {result.score}/10 {result.score >= 8 ? "🌱" : result.score >= 5 ? "🌿" : "🍃"}
            </p>
            <p className="text-xs text-[color:var(--foreground)]/65">
              {result.correct} מתוך {result.total} נכונות
              {result.score >= 8
                ? " — הפשט ברור לך, ממשיכים!"
                : result.score >= 5
                  ? " — רוב הסיפור ברור, כדאי להציץ שוב בפסוקים המסומנים"
                  : " — שווה לקרוא את הקטע שוב לפני חלק ב"}
            </p>
          </div>
          <span className="text-xs font-semibold text-[color:var(--success)]">
            {preview ? "תצוגה מקדימה למורה — לא נשמר" : "✓ נשלח למורה"}
          </span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-[color:var(--primary)]/55">
            {ready
              ? "הכל מלא — אפשר לבדוק. יש ניסיון אחד."
              : `ענו על כל השאלות (${answered}/${questions.length}) — יש ניסיון אחד, אז שווה לבדוק בפסוקים.`}
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || busy || locked}
            className="rounded-full bg-[color:var(--primary-fill)] px-6 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {busy ? "בודק…" : "לבדוק ✓"}
          </button>
        </div>
      )}
      {error && <p className="text-xs font-semibold text-[color:var(--danger)]">{error}</p>}
    </>
  );

  // ----- stepped: one question at a time, then a summary with "לבדוק" -----
  // Only while answering; the result screen shows every question with its
  // verdict, as before.
  if (stepped && !locked && questions.length > 0) {
    const stepCount = questions.length + (open ? 1 : 0);
    const isDone = (i: number) =>
      i < questions.length
        ? (() => {
            const q = questions[i];
            const g = given[q.key];
            return q.kind === "order"
              ? Array.isArray(g) && g.length === q.options.length
              : typeof g === "number";
          })()
        : openAnswer.trim().length >= 2;
    const go = (i: number) => {
      const next = Math.max(0, Math.min(stepCount, i));
      setStep(next);
      setFurthest((f) => Math.max(f, next));
    };
    const onSummary = step >= stepCount;
    const done = isDone(step);
    const openSteps = Array.from({ length: stepCount }, (_, i) => i).filter(
      (i) => !isDone(i) && i < questions.length
    );
    const labelOf = (i: number) =>
      i < questions.length ? questions[i].prompt : open!.prompt;

    return (
      <div className="space-y-4">
        {/* mini progress: "שאלה 2 מתוך 6" + a dot per question */}
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-bold text-[color:var(--primary)]">
              {onSummary ? "🏁 סיכום — לפני הבדיקה" : `שאלה ${step + 1} מתוך ${stepCount}`}
            </span>
            <span className="text-[11px] text-[color:var(--primary)]/55">
              נענו {Array.from({ length: stepCount }, (_, i) => i).filter(isDone).length} מתוך{" "}
              {stepCount}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]/50">
            <div
              className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)] transition-all duration-500"
              style={{ width: `${Math.round(((onSummary ? stepCount : step + 1) / stepCount) * 100)}%` }}
            />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {Array.from({ length: stepCount }, (_, i) => {
              const d = isDone(i);
              const o = !d && i < furthest;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`שאלה ${i + 1}${d ? " — נענתה" : o ? " — פתוחה" : ""}`}
                  aria-current={i === step ? "step" : undefined}
                  className="flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110"
                >
                  <span
                    className={[
                      "block rounded-full",
                      i === step
                        ? "h-3.5 w-3.5 bg-[color:var(--primary-fill)] ring-2 ring-[color:var(--accent)] ring-offset-1 ring-offset-[color:var(--background)]"
                        : d
                          ? "h-2.5 w-2.5 bg-[color:var(--success)]"
                          : o
                            ? "h-2.5 w-2.5 border-2 border-[color:var(--warning)] bg-[color:var(--warning)]/20"
                            : "h-2.5 w-2.5 border border-[color:var(--primary)]/35",
                    ].join(" ")}
                  />
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => go(stepCount)}
              className={[
                "ms-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition",
                onSummary
                  ? "bg-[color:var(--primary-fill)] text-white"
                  : "border border-[color:var(--border)] text-[color:var(--primary)]/60 hover:border-[color:var(--accent)]",
              ].join(" ")}
            >
              🏁 סיכום
            </button>
          </div>
        </div>

        {onSummary ? (
          <div className="slide-in space-y-3">
            {openSteps.length > 0 && (
              <p className="rounded-xl border border-[color:var(--warning)]/45 bg-[color:var(--warning)]/10 px-3 py-2 text-xs font-bold text-[color:var(--warning)]">
                {openSteps.length === 1
                  ? "נשארה שאלה אחת פתוחה"
                  : `נשארו ${openSteps.length} שאלות פתוחות`}{" "}
                — צריך לענות על כולן לפני הבדיקה
              </p>
            )}
            <ul className="space-y-1.5">
              {Array.from({ length: stepCount }, (_, i) => {
                const d = isDone(i);
                const short = labelOf(i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => go(i)}
                      className="flex w-full items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-start text-xs transition hover:border-[color:var(--accent)]"
                    >
                      <span
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                          d
                            ? "bg-[color:var(--success)] text-white"
                            : "border-2 border-[color:var(--warning)] text-[color:var(--warning)]",
                        ].join(" ")}
                      >
                        {d ? "✓" : i + 1}
                      </span>
                      <span className="flex-1 text-[color:var(--foreground)]/85">
                        {short.length > 90 ? `${short.slice(0, 90)}…` : short}
                        {i >= questions.length && (
                          <span className="ms-1 text-[10px] text-[color:var(--primary)]/50">
                            (שאלה פתוחה, לא חובה)
                          </span>
                        )}
                      </span>
                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                          d
                            ? "bg-[color:var(--success)]/12 text-[color:var(--success)]"
                            : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
                        ].join(" ")}
                      >
                        {d ? "נענתה" : "פתוחה"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              onClick={() => go(stepCount - 1)}
              className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
            >
              → חזרה לשאלה האחרונה
            </button>
            {resultOrSubmit}
          </div>
        ) : (
          <div key={step} className="slide-in space-y-3">
            {step < questions.length ? questionCard(questions[step], step) : openCard}
            <div className="flex items-center justify-between gap-3">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => go(step - 1)}
                  className="rounded-full border border-[color:var(--border)] px-5 py-2 text-xs font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
                >
                  → הקודם
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={() => go(step + 1)}
                disabled={!done && !preview}
                className="rounded-full bg-[color:var(--primary-fill)] px-7 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              >
                {step === stepCount - 1 ? "לסיכום ולבדיקה ←" : "הבא ←"}
              </button>
            </div>
            {!done && (
              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-end">
                {!preview && (
                  <span className="text-[11px] text-[color:var(--primary)]/55">
                    ״הבא״ ייפתח אחרי שתענו
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => go(step + 1)}
                  className="text-[11px] font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
                >
                  אחזור לזה אחר כך ↩
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => questionCard(q, i))}
      {openCard}
      {resultOrSubmit}
    </div>
  );
}

// Click the chips in the order you think is right; a numbered chip can be
// clicked again to take it out (later numbers shift down).
function OrderPicker({
  options,
  value,
  onChange,
  locked,
}: {
  options: string[];
  value: string[];
  onChange: (v: string[]) => void;
  locked: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const pos = value.indexOf(opt);
          const picked = pos >= 0;
          return (
            <button
              key={opt}
              type="button"
              disabled={locked}
              onClick={() =>
                onChange(picked ? value.filter((v) => v !== opt) : [...value, opt])
              }
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                picked
                  ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 font-semibold"
                  : "border-[color:var(--border)] bg-[color:var(--background)] hover:border-[color:var(--accent)]/50"
              } disabled:cursor-default`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-extrabold ${
                  picked
                    ? "bg-[color:var(--accent-fill)] text-white"
                    : "border border-[color:var(--border)] text-transparent"
                }`}
              >
                {picked ? pos + 1 : "·"}
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {value.length > 0 && !locked && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-[11px] font-semibold text-[color:var(--primary)]/55 hover:text-[color:var(--accent)]"
        >
          ↺ להתחיל את הסידור מחדש
        </button>
      )}
    </div>
  );
}
