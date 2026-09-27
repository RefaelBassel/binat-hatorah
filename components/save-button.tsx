"use client";

import { useEffect, useRef, useState } from "react";

// The one save button for every teacher editor on the site. Rafael's rule:
// a button must FEEL like it worked. Four visible states —
//   idle   : nothing to save (disabled, "אין שינויים")
//   armed  : there are unsaved changes (accent, gentle pulse, warning text)
//   saving : pressed-in look + spinner
//   saved  : success green, a check mark that draws itself, "נשמר!" (2s)
// — plus a browser warning when leaving the page with unsaved changes.
type Phase = "idle" | "armed" | "saving" | "saved" | "error";

export default function SaveButton({
  dirty,
  onSave,
  label = "שמירת השינויים",
  idleLabel = "אין שינויים",
  className = "",
}: {
  dirty: boolean;
  onSave: () => Promise<void>;
  label?: string;
  idleLabel?: string;
  className?: string;
}) {
  const [phase, setPhase] = useState<Phase>(dirty ? "armed" : "idle");
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  // the reset timers must read the CURRENT dirty flag, not the one captured
  // when the click happened (after a successful save it is usually false)
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);

  // follow the dirty flag unless we are mid-save / mid-celebration
  useEffect(() => {
    setPhase((p) => {
      if (p === "saving" || p === "saved") return p;
      return dirty ? "armed" : "idle";
    });
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const run = async () => {
    if (phase !== "armed") return;
    setPhase("saving");
    setError(null);
    try {
      await onSave();
      setPhase("saved");
      timer.current = window.setTimeout(() => {
        setPhase(dirtyRef.current ? "armed" : "idle");
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא נשמר — נסו שוב");
      setPhase("error");
      timer.current = window.setTimeout(
        () => setPhase(dirtyRef.current ? "armed" : "idle"),
        3200
      );
    }
  };

  const base =
    "relative inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold transition-all duration-200 select-none";
  const look: Record<Phase, string> = {
    idle: "cursor-not-allowed border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--foreground)]/40",
    armed:
      "bg-[color:var(--accent)] text-white shadow-md hover:scale-[1.03] save-armed",
    saving: "scale-[0.96] bg-[color:var(--accent)] text-white shadow-inner opacity-90",
    saved: "bg-[color:var(--success)] text-white shadow-md scale-[1.04]",
    error: "bg-[color:var(--danger)] text-white shadow-md",
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={run}
        disabled={phase === "idle" || phase === "saving"}
        aria-live="polite"
        className={`${base} ${look[phase]}`}
      >
        {phase === "saving" && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {phase === "saved" && (
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <path
              d="M4 12.5l5 5L20 6.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="save-check"
            />
          </svg>
        )}
        <span>
          {phase === "idle"
            ? idleLabel
            : phase === "armed"
              ? label
              : phase === "saving"
                ? "שומר…"
                : phase === "saved"
                  ? "נשמר!"
                  : "לא נשמר"}
        </span>
      </button>
      {phase === "armed" && (
        <span className="text-xs font-semibold text-[color:var(--warning)]">
          ● יש שינויים שעוד לא נשמרו
        </span>
      )}
      {phase === "saved" && (
        <span className="text-xs font-semibold text-[color:var(--success)] save-fade">
          השינויים נשמרו ויופיעו לתלמידים
        </span>
      )}
      {phase === "error" && error && (
        <span className="text-xs font-semibold text-[color:var(--danger)]">{error}</span>
      )}
    </div>
  );
}
