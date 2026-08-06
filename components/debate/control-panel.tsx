"use client";

import { useEffect, useState } from "react";

// Teacher's remote control for a live debate — works nicely from a phone.
export default function ControlPanel({ debateId }: { debateId: number }) {
  const [state, setState] = useState<{
    debate: { status: string; currentStage: number; currentQuestionId: number | null };
    questions: { id: number; orderIdx: number; question: string; votesOpen: boolean; done: boolean }[];
    stages: { title: string; side: string }[];
    remaining: number | null;
    running: boolean;
    results: Record<number, { n: number }>;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try {
      const res = await fetch(`/api/debate/${debateId}/state`, { cache: "no-store" });
      const data = await res.json();
      if (data.debate) setState(data);
    } catch {
      // keep last
    }
  };

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 2000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debateId]);

  const act = async (action: string) => {
    setBusy(true);
    try {
      await fetch(`/api/debate/${debateId}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!state) return <p className="animate-pulse text-sm">טוען...</p>;

  const { debate, questions, stages } = state;
  const stage = stages[debate.currentStage];
  const current = questions.find((q) => q.id === debate.currentQuestionId);
  const votes = current ? state.results[current.id]?.n ?? 0 : 0;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 text-center">
        <p className="text-xs text-[color:var(--primary)]/55">
          מצב: <b>{debate.status === "live" ? "🔴 לייב" : debate.status === "done" ? "הסתיים" : "בהכנה"}</b>
          {current && <> · שאלה {current.orderIdx}</>}
        </p>
        <p className="mt-1 font-display text-xl font-bold text-[color:var(--primary)]">
          {stage?.title ?? "—"}
        </p>
        <p className="font-display text-5xl font-extrabold tabular-nums text-[color:var(--accent)]">
          {state.remaining != null ? fmt(state.remaining) : "--:--"}
        </p>
        {!state.running && debate.status === "live" && (
          <p className="text-xs font-bold text-[color:var(--warning)]">⏸ מושהה</p>
        )}
        {current?.votesOpen && (
          <p className="mt-1 text-sm font-bold text-[color:var(--success)]">
            🗳️ ההצבעה פתוחה — {votes} הצבעות
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {debate.status === "draft" && (
          <Btn onClick={() => act("start")} disabled={busy} primary wide>
            ▶️ התחלת הדיבייט
          </Btn>
        )}
        {debate.status === "live" && (
          <>
            {state.running ? (
              <Btn onClick={() => act("pause")} disabled={busy}>⏸ השהיה</Btn>
            ) : (
              <Btn onClick={() => act("resume")} disabled={busy}>▶️ המשך</Btn>
            )}
            <Btn onClick={() => act("next-stage")} disabled={busy} primary>
              ⏭ לשלב הבא
            </Btn>
            <Btn onClick={() => act("prev-stage")} disabled={busy}>⏮ שלב אחורה</Btn>
            {current?.votesOpen && (
              <Btn onClick={() => act("close-votes")} disabled={busy}>
                🗳️ סגירת ההצבעה
              </Btn>
            )}
            <Btn onClick={() => act("next-question")} disabled={busy}>
              ➡️ לשאלה הבאה
            </Btn>
            <Btn onClick={() => act("finish")} disabled={busy} danger>
              🏁 סיום הדיבייט
            </Btn>
          </>
        )}
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <p className="mb-2 text-xs font-bold text-[color:var(--primary)]/60">השאלות</p>
        <ul className="space-y-1 text-sm">
          {questions.map((q) => (
            <li key={q.id} className="flex items-center gap-2">
              <span>
                {q.done ? "✅" : q.id === debate.currentQuestionId ? "🎙️" : "⏳"}
              </span>
              <span className={q.id === debate.currentQuestionId ? "font-bold" : ""}>
                {q.orderIdx}. {q.question}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  primary,
  danger,
  wide,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
  danger?: boolean;
  wide?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-40",
        wide ? "col-span-2" : "",
        primary
          ? "bg-[color:var(--primary)] text-white"
          : danger
            ? "border border-[color:var(--danger)]/50 text-[color:var(--danger)]"
            : "border border-[color:var(--border)] text-[color:var(--primary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
