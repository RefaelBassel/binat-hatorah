"use client";

import { useEffect, useRef, useState } from "react";

// The projected board screen. Dark, huge, readable from the back of the
// classroom. Polls the debate state; plays a chime when a stage ends.
interface StageInfo {
  key: string;
  title: string;
  side: "a" | "b" | "both" | "none";
  seconds: number;
  hint: string;
}

interface QuestionInfo {
  id: number;
  orderIdx: number;
  question: string;
  positionA: string;
  positionB: string;
  groupA: string;
  groupB: string;
  votesOpen: boolean;
  done: boolean;
}

interface StateResponse {
  debate: {
    id: number;
    title: string;
    status: string;
    currentQuestionId: number | null;
    currentStage: number;
  };
  questions: QuestionInfo[];
  stages: StageInfo[];
  remaining: number | null;
  running: boolean;
  results: Record<
    number,
    { n: number; axes: number[]; total: number }
  >;
}

const AXES = [
  "חוזק הנימוקים והראיות",
  "חשיפת הנחות היסוד",
  "הלוגיקה של המסקנות",
  "המענה להתקפות",
];

export default function LiveBoard({ debateId }: { debateId: number }) {
  const [state, setState] = useState<StateResponse | null>(null);
  const [localRemaining, setLocalRemaining] = useState<number | null>(null);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const chimed = useRef(false);
  const audioCtx = useRef<AudioContext | null>(null);

  // poll server state
  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/debate/${debateId}/state`, { cache: "no-store" });
        const data = await res.json();
        if (alive && data.debate) {
          setState(data);
          setLocalRemaining(data.remaining);
          if ((data.remaining ?? 1) > 3) chimed.current = false;
        }
      } catch {
        // keep last state
      }
    };
    poll();
    const iv = setInterval(poll, 1500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [debateId]);

  // local 1s countdown between polls + total clock
  useEffect(() => {
    const iv = setInterval(() => {
      setTotalElapsed((s) => s + 1);
      setLocalRemaining((r) => {
        if (r == null || !state?.running) return r;
        const next = Math.max(0, r - 1);
        if (next === 0 && !chimed.current) {
          chimed.current = true;
          chime();
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [state?.running]);

  const chime = () => {
    try {
      audioCtx.current ??= new AudioContext();
      const ctx = audioCtx.current;
      [0, 0.35, 0.7].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = i === 2 ? 880 : 660;
        osc.connect(gain);
        gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.35, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.32);
      });
    } catch {
      // no audio available
    }
  };

  if (!state) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1d1526] text-white">
        <p className="animate-pulse text-2xl">טוען את הדיבייט...</p>
      </div>
    );
  }

  const { debate, questions, stages, results } = state;
  const current = questions.find((q) => q.id === debate.currentQuestionId) ?? null;
  const stage = stages[debate.currentStage];
  const isVoteStage = stage?.key === "vote";
  const r = current ? results[current.id] : undefined;

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const timerColor =
    localRemaining == null
      ? "#fff"
      : localRemaining <= 10
        ? "#ff6b6b"
        : localRemaining <= 30
          ? "#ffc857"
          : "#7ee8a2";

  if (debate.status === "done") {
    return <FinalBoard title={debate.title} questions={questions} results={results} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#1d1526] px-10 py-8 text-white">
      {/* header */}
      <div className="mb-6 text-center">
        <p className="text-sm tracking-[0.4em] text-[#c9a5e0]">🎙️ בינת התורה · דיבייט</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold">{debate.title}</h1>
      </div>

      {current ? (
        <>
          {/* question + groups */}
          <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
            <GroupCard
              name={current.groupA}
              position={current.positionA}
              active={stage?.side === "a" || stage?.side === "both"}
              color="#e8b04b"
            />
            <div className="max-w-xl text-center">
              <p className="text-xs text-white/50">
                שאלה {current.orderIdx} מתוך {questions.length}
              </p>
              <p className="mt-1 font-display text-2xl font-bold leading-snug">
                {current.question}
              </p>
            </div>
            <GroupCard
              name={current.groupB}
              position={current.positionB}
              active={stage?.side === "b" || stage?.side === "both"}
              color="#6bb8ff"
            />
          </div>

          {/* stage + timer */}
          <div className="flex flex-1 flex-col items-center justify-center">
            {isVoteStage ? (
              <div className="text-center">
                <p className="font-display text-5xl font-extrabold text-[#c9a5e0]">
                  🗳️ {stage.title}
                </p>
                <p className="mt-3 text-xl text-white/70">
                  נכנסים לאתר ← הדיבייט ← ״להצבעה״ — ומדרגים בשפת הטיעון!
                </p>
                {r && (
                  <p className="mt-4 text-3xl font-bold text-[#7ee8a2]">
                    {r.n} הצבעות נקלטו
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="font-display text-4xl font-extrabold">
                  {stage?.title}
                  {stage?.side === "a" && ` — ${current.groupA}`}
                  {stage?.side === "b" && ` — ${current.groupB}`}
                  {stage?.side === "both" && " — שתי הקבוצות"}
                </p>
                <p className="mt-1 text-lg text-white/55">{stage?.hint}</p>
              </>
            )}
            <p
              className="mt-6 font-display text-[9rem] font-extrabold leading-none tabular-nums"
              style={{ color: timerColor }}
            >
              {localRemaining != null ? fmt(localRemaining) : "--:--"}
            </p>
            {!state.running && debate.status === "live" && (
              <p className="mt-2 animate-pulse text-lg text-[#ffc857]">⏸ מושהה</p>
            )}
          </div>
        </>
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-3xl text-white/60">ממתינים לתחילת הדיבייט...</p>
        </div>
      )}

      {/* footer: stage rail + total clock */}
      <div className="mt-6 flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5">
          {stages.map((s, i) => (
            <span
              key={`${s.key}-${i}`}
              className={[
                "rounded-full px-3 py-1 text-xs font-bold",
                i === debate.currentStage
                  ? "bg-white text-[#1d1526]"
                  : i < debate.currentStage
                    ? "bg-white/25 text-white/70"
                    : "bg-white/10 text-white/40",
              ].join(" ")}
            >
              {s.title}
            </span>
          ))}
        </div>
        <p className="whitespace-nowrap text-sm text-white/50">
          ⏱ זמן כולל: <span className="tabular-nums">{fmt(totalElapsed)}</span>
        </p>
      </div>
    </div>
  );
}

function GroupCard({
  name,
  position,
  active,
  color,
}: {
  name: string;
  position: string;
  active: boolean;
  color: string;
}) {
  return (
    <div
      className={[
        "rounded-3xl border-2 p-6 text-center transition-all",
        active ? "scale-105 bg-white/10" : "opacity-60",
      ].join(" ")}
      style={{ borderColor: active ? color : "rgba(255,255,255,0.15)" }}
    >
      <p className="font-display text-3xl font-extrabold" style={{ color }}>
        {name}
      </p>
      <p className="mt-2 text-sm leading-6 text-white/75">{position}</p>
      {active && <p className="mt-2 text-2xl">🎤</p>}
    </div>
  );
}

function FinalBoard({
  title,
  questions,
  results,
}: {
  title: string;
  questions: QuestionInfo[];
  results: Record<number, { n: number; axes: number[]; total: number }>;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-[#1d1526] px-10 py-10 text-white">
      <div className="mb-8 text-center">
        <p className="text-sm tracking-[0.4em] text-[#c9a5e0]">🏆 סיכום הדיבייט</p>
        <h1 className="mt-1 font-display text-4xl font-extrabold">{title}</h1>
      </div>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {questions.map((q) => {
          const r = results[q.id];
          const winner =
            !r || r.n === 0 || Math.abs(r.total) < 0.35
              ? null
              : r.total < 0
                ? q.groupA
                : q.groupB;
          return (
            <div key={q.id} className="rounded-3xl bg-white/5 p-6">
              <p className="text-lg font-bold">{q.orderIdx}. {q.question}</p>
              <p className="mt-2 text-2xl font-extrabold text-[#7ee8a2]">
                {winner ? `🏅 המנצחת: ${winner}` : "🤝 תיקו — שקול!"}
                {r && <span className="ms-3 text-sm font-normal text-white/50">({r.n} הצבעות)</span>}
              </p>
              {r && r.n > 0 && (
                <div className="mt-4 space-y-2">
                  {AXES.map((label, i) => {
                    const v = r.axes[i]; // -2..2, negative → A
                    const pct = ((v + 2) / 4) * 100;
                    return (
                      <div key={label} className="flex items-center gap-3 text-xs">
                        <span className="w-16 text-start font-bold" style={{ color: "#e8b04b" }}>
                          {q.groupA}
                        </span>
                        <div className="relative h-3 flex-1 rounded-full bg-white/10">
                          <div
                            className="absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full border-2 border-white"
                            style={{
                              insetInlineStart: `calc(${pct}% - 10px)`,
                              background: v < 0 ? "#e8b04b" : v > 0 ? "#6bb8ff" : "#999",
                            }}
                          />
                        </div>
                        <span className="w-16 text-end font-bold" style={{ color: "#6bb8ff" }}>
                          {q.groupB}
                        </span>
                        <span className="w-44 text-white/60">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-center text-white/50">
        💬 ועכשיו לעיבוד: אילו טיעונים שכנעו אתכם — ולמה? אילו הנחות יסוד נחשפו?
      </p>
    </div>
  );
}
