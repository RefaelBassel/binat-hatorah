"use client";

import { useState } from "react";
import { formatEntryDate, notebookText, type NotebookEntry } from "@/lib/notebook-shared";

// "ייבוא מהמחברת" inside "הסיכומים שלי" (issue #52): shows the student's own
// notebook entries of one unit, so the summary is easier to write. Display and
// copy only — nothing is written into the summary automatically.
export default function NotebookImport({ unitKey }: { unitKey: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [entries, setEntries] = useState<NotebookEntry[] | null>(null);
  const [lang, setLang] = useState<"he" | "en">("he");
  const [copied, setCopied] = useState<number | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setBusy(true);
    setError(false);
    try {
      const res = await fetch(`/api/notebook?unit=${encodeURIComponent(unitKey)}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries);
      setLang(data.lang === "en" ? "en" : "he");
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  async function copy(e: NotebookEntry) {
    try {
      await navigator.clipboard.writeText(notebookText(e.body));
      setCopied(e.id);
      window.setTimeout(() => setCopied((c) => (c === e.id ? null : c)), 2000);
    } catch {
      setError(true);
    }
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="rounded-full border-2 border-[color:var(--primary)]/40 px-4 py-1.5 text-sm font-bold text-[color:var(--primary)] transition hover:scale-[1.02]"
      >
        {busy ? "טוען…" : open ? "📓 הסתרת הרשומות" : "📓 ייבוא מהמחברת"}
      </button>
      {open && !busy && (
        <div className="mt-3 space-y-3">
          {error ? (
            <p className="text-xs font-semibold text-[color:var(--danger)]">לא הצלחנו לטעון את המחברת — נסו שוב.</p>
          ) : entries && entries.length === 0 ? (
            <p className="text-sm text-[color:var(--foreground)]/65">אין עדיין רשומות במחברת מהיחידה הזאת.</p>
          ) : (
            entries?.map((e) => (
              <div key={e.id} className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-[color:var(--accent)]">
                    {formatEntryDate(e.entryDate, lang)}
                    {e.title && <span className="text-[color:var(--primary)]"> · {e.title}</span>}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copy(e)}
                    className="rounded-full border border-[color:var(--border)] px-3 py-0.5 text-xs font-bold text-[color:var(--primary)]"
                  >
                    {copied === e.id ? "הועתק ✓" : "העתקה"}
                  </button>
                </div>
                <p dir="rtl" className="mt-2 whitespace-pre-line text-sm leading-6 text-[color:var(--foreground)]">
                  {notebookText(e.body) || "(רשומה ריקה)"}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
