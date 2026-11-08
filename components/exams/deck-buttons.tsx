"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "🖥️ מצגת חזרה" (opens / creates the exam's deck) and "מצגת חדשה" (blank deck).
export function DeckButton({ examId, label, primary }: { examId?: number; label: string; primary?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch("/api/decks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(examId != null ? { action: "exam", examId } : { action: "create" }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(`/dashboard/exams/deck/${data.id}`);
          } catch (e) {
            setErr(e instanceof Error && e.message ? e.message : "לא הצליח. נסו שוב.");
            setBusy(false);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-full font-bold transition disabled:opacity-70 ${
          examId != null ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm"
        } ${
          primary
            ? "bg-[color:var(--accent-fill)] text-white shadow hover:scale-[1.03]"
            : "border-2 border-[color:var(--primary)]/50 text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
        } ${busy ? "scale-[0.96]" : ""}`}
      >
        {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
        {busy ? "פותח…" : label}
      </button>
      {err && <span className="text-xs text-[color:var(--danger)]">{err}</span>}
    </span>
  );
}
