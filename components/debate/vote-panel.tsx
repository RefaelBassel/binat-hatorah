"use client";

import { useEffect, useState } from "react";

// Audience voting from the phone: 4 sliders in the argument-skill language,
// each between the two groups. -2..2 (negative → group A stronger).
const AXES = [
  { key: "reasons", label: "חוזק הנימוקים והראיות", emoji: "🧱" },
  { key: "assumptions", label: "חשיפת הנחות היסוד של היריבה", emoji: "🔍" },
  { key: "logic", label: "הלוגיקה של המסקנות", emoji: "🧠" },
  { key: "rebuttal", label: "המענה להתקפות", emoji: "🛡️" },
] as const;

export default function VotePanel({ debateId }: { debateId: number }) {
  const [state, setState] = useState<{
    questions: {
      id: number;
      orderIdx: number;
      question: string;
      groupA: string;
      groupB: string;
      votesOpen: boolean;
    }[];
  } | null>(null);
  const [values, setValues] = useState<Record<string, number>>({
    reasons: 0,
    assumptions: 0,
    logic: 0,
    rebuttal: 0,
  });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const res = await fetch(`/api/debate/${debateId}/state`, { cache: "no-store" });
        const data = await res.json();
        if (alive && data.questions) setState(data);
      } catch {
        // keep last
      }
    };
    poll();
    const iv = setInterval(poll, 2500);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [debateId]);

  if (!state) return <p className="animate-pulse text-center text-sm">טוען...</p>;

  const open = state.questions.find((q) => q.votesOpen);
  if (!open) {
    return (
      <div className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center">
        <p className="text-3xl">🕰️</p>
        <p className="mt-2 font-display text-lg font-bold text-[color:var(--primary)]">
          ההצבעה עוד לא נפתחה
        </p>
        <p className="mt-1 text-xs text-[color:var(--foreground)]/60">
          כשהמורה תפתח את ההצבעה — הטופס יופיע כאן אוטומטית. בינתיים: הקשיבו
          היטב לנימוקים, להנחות היסוד ולמסקנות! 🎧
        </p>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/debate/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: open.id, ...values }),
      });
      if ((await res.json()).ok) setSent(true);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-2xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 p-8 text-center">
        <p className="text-4xl">🗳️</p>
        <p className="mt-2 font-display text-lg font-bold text-[color:var(--success)]">
          ההצבעה נקלטה!
        </p>
        <p className="mt-1 text-xs text-[color:var(--foreground)]/60">
          אפשר לשנות את ההצבעה כל עוד היא פתוחה — פשוט רענני והצביעי שוב.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 text-center">
        <p className="text-xs text-[color:var(--primary)]/55">שאלה {open.orderIdx}</p>
        <p className="mt-1 font-display text-lg font-bold leading-snug text-[color:var(--primary)]">
          {open.question}
        </p>
        <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
          בכל ציר — גררי את הנקודה לכיוון הקבוצה שהייתה חזקה יותר. באמצע = שקול.
        </p>
      </div>

      {AXES.map((ax) => (
        <div key={ax.key} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          <p className="mb-2 text-center text-sm font-bold text-[color:var(--primary)]">
            {ax.emoji} {ax.label}
          </p>
          <input
            type="range"
            min={-2}
            max={2}
            step={1}
            value={values[ax.key]}
            onChange={(e) =>
              setValues((v) => ({ ...v, [ax.key]: Number(e.target.value) }))
            }
            className="w-full accent-[#413055]"
            dir="ltr"
          />
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-[#2f5d8a]">{open.groupB} ←</span>
            <span className="text-[color:var(--primary)]/40">שקול</span>
            <span className="text-[#8a6516]">→ {open.groupA}</span>
          </div>
        </div>
      ))}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-full bg-[color:var(--primary)] py-3.5 text-sm font-bold text-white shadow-lg disabled:opacity-50"
      >
        {busy ? "שולחת..." : "שליחת ההצבעה 🗳️"}
      </button>
    </div>
  );
}
