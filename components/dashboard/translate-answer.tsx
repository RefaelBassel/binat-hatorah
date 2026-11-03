"use client";

import { useState } from "react";

// Beside an answer written (even partly) in English: its Hebrew, on demand.
export default function TranslateAnswer({ text }: { text: string }) {
  const [he, setHe] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "working" | "error">("idle");
  if (!/[a-zA-Z]{3,}/.test(text)) return null;
  const run = async () => {
    setPhase("working");
    try {
      const r = await fetch("/api/translate-answer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.ok) throw new Error();
      setHe(String(d.he));
      setPhase("idle");
    } catch {
      setPhase("error");
    }
  };
  return (
    <div className="mt-2">
      {he === null ? (
        <button
          type="button"
          onClick={run}
          disabled={phase === "working"}
          className="rounded-full border border-[color:var(--primary)]/40 px-3 py-0.5 text-[11px] font-bold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10 disabled:cursor-wait"
        >
          {phase === "working" ? "מתרגם…" : phase === "error" ? "התרגום נכשל — לנסות שוב" : "🌐 תרגום לעברית"}
        </button>
      ) : (
        <p className="whitespace-pre-wrap rounded-lg border-s-2 border-[color:var(--accent)] bg-[color:var(--card)] px-3 py-2 text-sm leading-6 text-[color:var(--foreground)]/85">
          <span className="me-1 text-[10px] font-bold text-[color:var(--accent)]">תרגום:</span>
          {he}
        </p>
      )}
    </div>
  );
}
