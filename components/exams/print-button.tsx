"use client";

import { useState } from "react";

// Opens the browser's print dialog (which also offers "save as PDF").
export default function PrintButton({ label = "הדפסה / PDF" }: { label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        // let the "opening…" state paint before the blocking print dialog
        window.setTimeout(() => {
          window.print();
          setBusy(false);
        }, 60);
      }}
      className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white shadow-md transition hover:scale-[1.03] disabled:opacity-70"
    >
      {busy && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      {busy ? "פותח את חלון ההדפסה…" : `🖨 ${label}`}
    </button>
  );
}
