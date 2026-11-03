"use client";

import { useState } from "react";
import ActionButton, { postJson } from "./action-button";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";
import type { ExamDoc, PrepDoc } from "@/lib/exams-types";

type Version = { id: number; title: string; label: string | null; createdAt: number };

// "החזרה לגרסה קודמת": lists the saved versions; restoring one first keeps the
// current state as a version, so a restore can be undone too.
export default function VersionsPanel({
  examId,
  flush,
  onRestored,
}: {
  examId: number;
  flush: () => Promise<void>;
  onRestored: (title: string, doc: ExamDoc | PrepDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      await flush(); // make sure the newest edits are in the DB first
      const res = await fetch(`/api/exams/${examId}/versions`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "לא הצלחנו לטעון את ההיסטוריה");
      setVersions(data.versions as Version[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצלחנו לטעון את ההיסטוריה");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="no-print">
      <button
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load();
        }}
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)] hover:border-[color:var(--accent)]"
      >
        ↶ החזרה לגרסה קודמת
      </button>
      {open && (
        <div className="mt-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
          {loading && (
            <p className="flex items-center gap-2 text-sm">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--border)] border-t-[color:var(--accent)]" />
              טוען את ההיסטוריה…
            </p>
          )}
          {error && <p className="text-sm font-semibold text-[color:var(--danger)]">{error}</p>}
          {!loading && versions && versions.length === 0 && (
            <p className="text-sm text-[color:var(--foreground)]/65">
              עוד אין גרסאות קודמות — הן נוצרות אוטומטית תוך כדי עריכה.
            </p>
          )}
          {!loading && versions && versions.length > 0 && (
            <ul className="divide-y divide-[color:var(--border)]">
              {versions.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                  <span className="text-sm">
                    <b>
                      {formatHebDate(v.createdAt)} · {formatHebTime(v.createdAt)}
                    </b>
                    {v.label && (
                      <span className="ms-2 text-xs text-[color:var(--foreground)]/60">({v.label})</span>
                    )}
                    <span className="ms-2 text-xs text-[color:var(--foreground)]/60">{v.title}</span>
                  </span>
                  <ActionButton
                    tone="plain"
                    busyLabel="מחזיר…"
                    doneLabel="הוחזר"
                    confirmMessage="להחזיר את הגרסה הזו? המצב הנוכחי יישמר בהיסטוריה."
                    onClick={async () => {
                      const data = await postJson<{ title: string; doc: ExamDoc | PrepDoc }>(
                        `/api/exams/${examId}/versions`,
                        { versionId: v.id }
                      );
                      onRestored(data.title, data.doc);
                      await load();
                    }}
                  >
                    החזרה לגרסה הזו
                  </ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
