"use client";

import { useEffect, useRef, useState } from "react";

// A button for a one-off action (publish, duplicate, approve…) that shows its
// state: idle → busy (spinner + busyLabel) → done (green check, doneLabel) or
// error (red, the message under the button). The handler throws an Error with
// a Hebrew message to show a failure.
type Phase = "idle" | "busy" | "done" | "error";

export default function ActionButton({
  onClick,
  children,
  busyLabel = "רגע…",
  doneLabel = "בוצע",
  tone = "primary",
  confirmMessage,
  disabled = false,
  className = "",
}: {
  onClick: () => Promise<void>;
  children: React.ReactNode;
  busyLabel?: string;
  doneLabel?: string;
  tone?: "primary" | "accent" | "danger" | "plain";
  confirmMessage?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const look: Record<typeof tone, string> = {
    primary: "bg-[color:var(--primary-fill)] text-white",
    accent: "bg-[color:var(--accent-fill)] text-white",
    danger: "bg-[color:var(--danger-fill)] text-white",
    plain:
      "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:border-[color:var(--accent)]",
  };

  const run = async () => {
    if (phase === "busy" || disabled) return;
    if (confirmMessage && !window.confirm(confirmMessage)) return;
    setPhase("busy");
    setError(null);
    try {
      await onClick();
      setPhase("done");
      timer.current = window.setTimeout(() => setPhase("idle"), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "הפעולה נכשלה — נסו שוב");
      setPhase("error");
      timer.current = window.setTimeout(() => setPhase("idle"), 5000);
    }
  };

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={disabled || phase === "busy"}
        aria-live="polite"
        className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
          phase === "done"
            ? "bg-[color:var(--success-fill)] text-white"
            : phase === "error"
              ? "bg-[color:var(--danger-fill)] text-white"
              : look[tone]
        } ${phase === "busy" ? "scale-[0.97] opacity-90" : ""} ${className}`}
      >
        {phase === "busy" && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {phase === "done" && <span aria-hidden>✓</span>}
        <span>
          {phase === "busy" ? busyLabel : phase === "done" ? doneLabel : phase === "error" ? "לא הצליח" : children}
        </span>
      </button>
      {phase === "error" && error && (
        <span className="max-w-xs text-xs font-semibold text-[color:var(--danger)]">{error}</span>
      )}
    </span>
  );
}

// fetch helper shared by the exam UIs: throws an Error carrying the server's
// Hebrew message.
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: unknown,
  method: "POST" | "PUT" | "DELETE" = "POST"
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? "הפעולה נכשלה — נסו שוב");
  return data as T;
}
