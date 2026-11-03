"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// "מבחן חדש" / "דף הכנה חדש" / "שכפול" — each shows its own state.
export function CreateButton({ kind, label, primary }: { kind: "exam" | "prep"; label: string; primary?: boolean }) {
  return <ActionButton payload={{ action: "create", kind }} label={label} busyLabel="יוצר…" primary={primary} />;
}

export function DuplicateButton({ id }: { id: number }) {
  return <ActionButton payload={{ action: "duplicate", id }} label="שכפול" busyLabel="משכפל…" small />;
}

function ActionButton({
  payload,
  label,
  busyLabel,
  primary,
  small,
}: {
  payload: Record<string, unknown>;
  label: string;
  busyLabel: string;
  primary?: boolean;
  small?: boolean;
}) {
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
            const res = await fetch("/api/exams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(`/dashboard/exams/${data.id}`);
          } catch (e) {
            setErr(e instanceof Error && e.message ? e.message : "לא הצליח. נסו שוב.");
            setBusy(false);
          }
        }}
        className={`inline-flex items-center gap-2 rounded-full font-bold transition disabled:opacity-70 ${
          small ? "px-3 py-1 text-xs" : "px-5 py-2 text-sm"
        } ${
          primary
            ? "bg-[color:var(--accent-fill)] text-white shadow hover:scale-[1.03]"
            : "border-2 border-[color:var(--primary)]/50 text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
        } ${busy ? "scale-[0.96]" : ""}`}
      >
        {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
        {busy ? busyLabel : label}
      </button>
      {err && <span className="text-xs text-[color:var(--danger)]">{err}</span>}
    </span>
  );
}

export function PrintNow() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[color:var(--primary-fill)] px-5 py-2 text-sm font-bold text-white shadow"
    >
      🖨 הדפסה / שמירה כ־PDF
    </button>
  );
}
