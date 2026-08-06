"use client";

import { useState } from "react";
import type {
  WritingExercise,
  WritingLevel,
} from "@/content/writing/exercises";
import { COMPONENT_LABELS } from "@/content/writing/exercises";

// The interactive practice space: levels → short exercise cards → inline
// runner. Claude gives formative feedback; scores are saved and reported.

interface ResultInfo {
  score: number | null;
  feedback: string | null;
}

export default function WritingSpace({
  levels,
  initialResults,
}: {
  levels: WritingLevel[];
  initialResults: Record<string, ResultInfo>;
}) {
  const [results, setResults] = useState(initialResults);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <div className="space-y-10">
      {levels.map((level) => {
        const done = level.exercises.filter((e) => results[e.key]).length;
        return (
          <section key={level.n}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--primary)] text-lg">
                {level.emoji}
              </span>
              <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">
                רמה {level.n} · {level.title}
              </h2>
              <span className="rounded-full bg-[color:var(--accent)]/15 px-3 py-1 text-[11px] font-bold text-[color:var(--accent)]">
                {done}/{level.exercises.length} הושלמו
              </span>
            </div>
            <p className="mb-4 max-w-2xl text-sm leading-6 text-[color:var(--foreground)]/70">
              {level.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {level.exercises.map((ex) => {
                const r = results[ex.key];
                const open = openKey === ex.key;
                return (
                  <div
                    key={ex.key}
                    className={[
                      "rounded-2xl border bg-[color:var(--card)] transition",
                      open
                        ? "sm:col-span-2 lg:col-span-3 border-[color:var(--accent)]"
                        : "border-[color:var(--border)] hover:border-[color:var(--accent)]/50",
                    ].join(" ")}
                  >
                    <button
                      onClick={() => setOpenKey(open ? null : ex.key)}
                      className="flex w-full items-start justify-between gap-2 p-4 text-start"
                    >
                      <span>
                        <span className="block text-[11px] font-bold text-[color:var(--accent)]">
                          {ex.flavor}
                        </span>
                        <span className="font-display text-base font-bold text-[color:var(--primary)]">
                          {ex.title}
                        </span>
                        <span className="mt-0.5 block text-[11px] text-[color:var(--primary)]/50">
                          🎯 {ex.why}
                        </span>
                      </span>
                      <span className="shrink-0">
                        {r?.score != null ? (
                          <span
                            className={[
                              "rounded-full px-2.5 py-1 text-xs font-bold",
                              r.score >= 80
                                ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                                : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
                            ].join(" ")}
                          >
                            {r.score}
                          </span>
                        ) : r ? (
                          <span className="rounded-full bg-[#e3edf7] px-2.5 py-1 text-xs font-bold text-[#2f5d8a]">
                            נשלח ✓
                          </span>
                        ) : (
                          <span className="text-lg">{open ? "▴" : "▾"}</span>
                        )}
                      </span>
                    </button>
                    {open && (
                      <div className="border-t border-[color:var(--border)] p-4">
                        <ExerciseRunner
                          exercise={ex}
                          prev={r ?? null}
                          onDone={(res) => {
                            setResults((rs) => ({ ...rs, [ex.key]: res }));
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ExerciseRunner({
  exercise,
  prev,
  onDone,
}: {
  exercise: WritingExercise;
  prev: ResultInfo | null;
  onDone: (r: ResultInfo) => void;
}) {
  const [tagChoices, setTagChoices] = useState<Record<string, string>>({});
  const [mcChoice, setMcChoice] = useState<number | null>(null);
  const [freeValues, setFreeValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    score: number | null;
    feedback: string;
    details?: Record<string, boolean> | null;
  } | null>(null);

  const canSubmit =
    exercise.kind === "tag"
      ? exercise.sentences.every((s) => tagChoices[s.id])
      : exercise.kind === "mc"
        ? mcChoice != null
        : exercise.fields.every((f) => (freeValues[f.key] ?? "").trim().length >= 3);

  const submit = async () => {
    setBusy(true);
    try {
      const answers =
        exercise.kind === "tag"
          ? tagChoices
          : exercise.kind === "mc"
            ? { choice: mcChoice }
            : freeValues;
      const res = await fetch("/api/writing/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseKey: exercise.key, answers }),
      });
      const data = await res.json();
      if (data.ok) {
        setResult({ score: data.score, feedback: data.feedback, details: data.details });
        onDone({ score: data.score, feedback: data.feedback });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {exercise.kind === "tag" && (
        <>
          <p className="mb-3 text-sm text-[color:var(--foreground)]/75">{exercise.intro}</p>
          <div className="space-y-3">
            {exercise.sentences.map((s) => (
              <div
                key={s.id}
                className={[
                  "rounded-xl border p-3",
                  result?.details
                    ? result.details[s.id]
                      ? "border-[color:var(--success)]/60 bg-[color:var(--success)]/5"
                      : "border-[color:var(--danger)]/60 bg-[color:var(--danger)]/5"
                    : "border-[color:var(--border)]",
                ].join(" ")}
              >
                <p className="mb-2 text-[15px] leading-7">
                  {result?.details && (result.details[s.id] ? "✅ " : "❌ ")}
                  ״{s.text}״
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {COMPONENT_LABELS.map((label) => (
                    <button
                      key={label}
                      disabled={Boolean(result)}
                      onClick={() => setTagChoices((c) => ({ ...c, [s.id]: label }))}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        tagChoices[s.id] === label
                          ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white"
                          : "border-[color:var(--border)] text-[color:var(--primary)] hover:border-[color:var(--accent)]",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {exercise.kind === "mc" && (
        <>
          <p className="mb-3 text-[15px] leading-7">{exercise.prompt}</p>
          <div className="space-y-2">
            {exercise.options.map((opt, i) => (
              <button
                key={i}
                disabled={Boolean(result)}
                onClick={() => setMcChoice(i)}
                className={[
                  "block w-full rounded-xl border px-4 py-2.5 text-start text-sm transition",
                  mcChoice === i
                    ? "border-[color:var(--primary)] bg-[color:var(--primary)]/8 font-semibold"
                    : "border-[color:var(--border)] hover:border-[color:var(--accent)]",
                ].join(" ")}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}

      {exercise.kind === "free" && (
        <>
          <p className="mb-3 text-[15px] leading-7">{exercise.prompt}</p>
          <div className="space-y-3">
            {exercise.fields.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-bold text-[color:var(--primary)]/70">
                  {f.label}
                </span>
                <textarea
                  value={freeValues[f.key] ?? ""}
                  onChange={(e) =>
                    setFreeValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                  disabled={Boolean(result)}
                  rows={2}
                  placeholder={f.placeholder ?? "כתבי כאן..."}
                  className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
                />
              </label>
            ))}
          </div>
        </>
      )}

      {/* feedback */}
      {(result || prev?.feedback) && (
        <div className="mt-4 rounded-xl bg-[color:var(--primary)]/5 p-4">
          <p className="mb-1 text-xs font-bold text-[color:var(--primary)]">
            ✨ המשוב של קלוד
            {(result?.score ?? prev?.score) != null && (
              <span className="ms-2 rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[color:var(--accent)]">
                {result?.score ?? prev?.score}
              </span>
            )}
          </p>
          <p className="text-sm leading-6 text-[color:var(--foreground)]/85">
            {result?.feedback ?? prev?.feedback}
          </p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {!result ? (
          <button
            onClick={submit}
            disabled={!canSubmit || busy}
            className="rounded-full bg-[color:var(--primary)] px-8 py-2.5 text-sm font-bold text-white shadow disabled:opacity-40"
          >
            {busy ? "בודקת..." : "בדיקה ✨"}
          </button>
        ) : (
          <button
            onClick={() => {
              setResult(null);
              setTagChoices({});
              setMcChoice(null);
            }}
            className="rounded-full border border-[color:var(--border)] px-6 py-2 text-sm font-semibold text-[color:var(--primary)]"
          >
            🔄 עוד ניסיון
          </button>
        )}
      </div>
    </div>
  );
}
