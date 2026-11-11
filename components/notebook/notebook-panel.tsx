"use client";

import { useEffect, useState } from "react";
import NotebookApp from "./notebook-app";

// "📓 מחברת" on the task page (issue #52): opens the notebook in a side panel
// so a summary can be written without leaving the task. The panel loads its
// own data the first time it opens; an entry created here picks the task's
// unit by default.
export default function NotebookPanel({ unitKey }: { unitKey: string }) {
  const [open, setOpen] = useState(false);
  const [everOpened, setEverOpened] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="no-print">
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setEverOpened(true);
        }}
        className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] shadow-sm transition hover:border-[color:var(--accent)]"
      >
        📓 מחברת
      </button>

      {open && <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setOpen(false)} aria-hidden />}
      <aside
        aria-hidden={!open}
        aria-label="המחברת שלי"
        dir="rtl"
        className="fixed inset-y-0 right-0 z-50 flex w-[28rem] max-w-[92vw] flex-col shadow-2xl transition-transform duration-200 ease-out"
        style={{
          backgroundColor: "var(--background)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          visibility: open ? "visible" : "hidden",
        }}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-4 py-3">
          <span className="font-display text-base font-extrabold text-[color:var(--primary)]">📓 המחברת שלי</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגירת המחברת"
            className="rounded-lg px-2 py-1 text-lg text-[color:var(--primary)]/70 hover:bg-[color:var(--primary)]/5"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {everOpened && <NotebookApp compact defaultUnit={unitKey} />}
        </div>
      </aside>
    </div>
  );
}
