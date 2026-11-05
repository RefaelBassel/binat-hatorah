"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_COMMENTATOR_ROWS,
  SUMMARY_FIELDS,
  parseCommentators,
  serializeCommentators,
  type CommentatorRow,
  type SummaryField,
  type SummaryUnit,
  type SummaryValues,
} from "@/lib/exam-summary-types";

// "הסיכומים שלי" (issue #28): one card per unit, four fields + free notes,
// saved automatically per field. Private to the student and the teachers;
// nothing is graded or checked.

type Phase = "idle" | "saving" | "saved" | "error";

export default function MySummaries({
  examId,
  examTitle,
  units,
  initial,
  readOnly,
}: {
  examId: number;
  examTitle: string;
  units: SummaryUnit[];
  initial: Record<string, SummaryValues>;
  readOnly: boolean;
}) {
  const blank = (): SummaryValues => ({ whatHappened: "", keyVerse: "", commentator: "", message: "", notes: "" });
  const [values, setValues] = useState<Record<string, SummaryValues>>(() =>
    Object.fromEntries(units.map((u) => [u.key, { ...blank(), ...(initial[u.key] ?? {}) }]))
  );
  const [rows, setRows] = useState<Record<string, CommentatorRow[]>>(() =>
    Object.fromEntries(
      units.map((u) => {
        const parsed = parseCommentators(initial[u.key]?.commentator ?? "");
        return [u.key, parsed.length > 0 ? parsed : [{ name: "", says: "" }]];
      })
    )
  );
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const [exporting, setExporting] = useState<"summary" | "tasks" | null>(null);
  // fields with edits not yet confirmed saved: "unit|field" → latest text
  const pending = useRef(new Map<string, string>());
  const timers = useRef(new Map<string, number>());

  const setUnitPhase = (unit: string, p: Phase) => setPhase((cur) => ({ ...cur, [unit]: p }));

  const flushOne = useCallback(
    async (id: string) => {
      const text = pending.current.get(id);
      if (text == null) return;
      const [unit, field] = id.split("|");
      const t = timers.current.get(id);
      if (t) window.clearTimeout(t);
      timers.current.delete(id);
      setUnitPhase(unit, "saving");
      try {
        const res = await fetch(`/api/exams/${examId}/summary`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ unit, field, value: text }),
        });
        if (!res.ok) throw new Error();
        // a newer edit may have arrived while saving
        if (pending.current.get(id) === text) pending.current.delete(id);
        setUnitPhase(unit, pending.current.size > 0 ? "saving" : "saved");
      } catch {
        setUnitPhase(unit, "error");
      }
    },
    [examId]
  );

  const flushAll = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map((id) => flushOne(id)));
  }, [flushOne]);

  function edit(unit: string, field: SummaryField, text: string) {
    setValues((cur) => ({ ...cur, [unit]: { ...cur[unit], [field]: text } }));
    const id = `${unit}|${field}`;
    pending.current.set(id, text);
    setUnitPhase(unit, "saving");
    const old = timers.current.get(id);
    if (old) window.clearTimeout(old);
    timers.current.set(id, window.setTimeout(() => void flushOne(id), 900));
  }

  // commentator rows: each edit saves the whole list through the same autosave
  function commitRows(unit: string, next: CommentatorRow[]) {
    setRows((cur) => ({ ...cur, [unit]: next }));
    edit(unit, "commentator", serializeCommentators(next));
  }
  function editRow(unit: string, i: number, patch: Partial<CommentatorRow>) {
    commitRows(unit, rows[unit].map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }
  function addRow(unit: string) {
    if (rows[unit].length >= MAX_COMMENTATOR_ROWS) return;
    setRows((cur) => ({ ...cur, [unit]: [...cur[unit], { name: "", says: "" }] }));
  }
  function removeRow(unit: string, i: number) {
    if (!window.confirm("למחוק את הפרשן הזה?")) return;
    const left = rows[unit].filter((_, j) => j !== i);
    commitRows(unit, left.length > 0 ? left : [{ name: "", says: "" }]);
  }

  // warn when leaving with text that did not reach the server yet
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending.current.size > 0) {
        e.preventDefault();
        void flushAll();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [flushAll]);

  async function openExport(kind: "summary" | "tasks") {
    setExporting(kind);
    const url = `/exams/summary/${examId}/${kind === "summary" ? "print" : "tasks"}`;
    // open the tab inside the click (phones block popups opened later), then
    // point it at the print page once every pending edit reached the server
    const tab = window.open("", "_blank");
    try {
      await flushAll();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } finally {
      window.setTimeout(() => setExporting(null), 600);
    }
  }

  return (
    <section
      id="my-summaries"
      className="mx-auto mt-8 max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm sm:p-8"
    >
      <h2 className="font-display text-2xl font-extrabold text-[color:var(--primary)]">✍️ הסיכומים שלי</h2>
      <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
        {examTitle}. מסכמות כל יחידה בארבע שורות. הכתיבה נשמרת אוטומטית, ורק את והמורה רואות אותה.
      </p>
      {readOnly && (
        <p className="mt-3 rounded-xl bg-[color:var(--warning)]/15 p-3 text-sm font-semibold text-[color:var(--warning)]">
          צופים במצב אורח: כדי לכתוב סיכומים צריך להתחבר עם חשבון.
        </p>
      )}

      <div className="mt-5 space-y-4">
        {units.map((u) => {
          const p = phase[u.key] ?? "idle";
          return (
            <article
              key={u.key}
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4"
            >
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-lg font-bold text-[color:var(--primary)]">
                  {u.title} <span className="text-sm font-normal text-[color:var(--foreground)]/60">({u.chapters})</span>
                </h3>
                <span
                  role="status"
                  aria-live="polite"
                  className={`text-xs font-semibold ${
                    p === "saved"
                      ? "text-[color:var(--success)]"
                      : p === "error"
                        ? "text-[color:var(--danger)]"
                        : "text-[color:var(--foreground)]/60"
                  }`}
                >
                  {p === "saving" && "שומרת…"}
                  {p === "saved" && "✓ נשמר"}
                  {p === "error" && "השמירה נכשלה. אפשר להמשיך להקליד, והשמירה תיוסף שוב."}
                </span>
              </header>
              <div className="grid gap-3 sm:grid-cols-2">
                {SUMMARY_FIELDS.map((f) =>
                  f.key === "commentator" ? (
                    <div key={f.key} className="block">
                      <span className="mb-1 block text-sm font-bold">{f.label}</span>
                      <ul className="space-y-2">
                        {rows[u.key].map((r, i) => (
                          <li
                            key={i}
                            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2"
                          >
                            <div className="flex items-start gap-2">
                              <div className="grid min-w-0 flex-1 gap-2">
                                <input
                                  type="text"
                                  dir="auto"
                                  maxLength={60}
                                  readOnly={readOnly}
                                  aria-label="שם הפרשן"
                                  placeholder="שם הפרשן"
                                  value={r.name}
                                  onChange={(e) => editRow(u.key, i, { name: e.target.value })}
                                  onBlur={() => void flushOne(`${u.key}|commentator`)}
                                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 text-base"
                                />
                                <textarea
                                  dir="auto"
                                  rows={2}
                                  maxLength={1500}
                                  readOnly={readOnly}
                                  aria-label="מה הוא אומר במשפט אחד"
                                  placeholder="מה הוא אומר במשפט אחד"
                                  value={r.says}
                                  onChange={(e) => editRow(u.key, i, { says: e.target.value })}
                                  onBlur={() => void flushOne(`${u.key}|commentator`)}
                                  className="w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 text-base leading-7"
                                />
                              </div>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => removeRow(u.key, i)}
                                  aria-label="מחיקת הפרשן"
                                  title="מחיקת הפרשן"
                                  className="shrink-0 rounded-lg border border-[color:var(--danger)]/40 px-2 py-1 text-base text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                                >
                                  🗑
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                      {!readOnly && rows[u.key].length < MAX_COMMENTATOR_ROWS && (
                        <button
                          type="button"
                          onClick={() => addRow(u.key)}
                          className="mt-2 rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-1.5 text-sm font-bold text-[color:var(--primary)] transition hover:scale-[1.02]"
                        >
                          ➕ הוספת פרשן
                        </button>
                      )}
                    </div>
                  ) : (
                  <label key={f.key} className={`block ${f.key === "notes" ? "sm:col-span-2" : ""}`}>
                    <span className="mb-1 block text-sm font-bold">
                      {f.label}
                      {f.hint && <span className="font-normal text-[color:var(--foreground)]/60"> ({f.hint})</span>}
                    </span>
                    <textarea
                      dir="auto"
                      rows={f.rows}
                      maxLength={4000}
                      readOnly={readOnly}
                      value={values[u.key][f.key]}
                      onChange={(e) => edit(u.key, f.key, e.target.value)}
                      onBlur={() => void flushOne(`${u.key}|${f.key}`)}
                      className="w-full resize-y rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2 text-base leading-7"
                    />
                  </label>
                  )
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ExportButton busy={exporting === "summary"} onClick={() => openExport("summary")} primary>
            📄 ייצוא הסיכום שלי (הדפסה / PDF)
          </ExportButton>
          <ExportButton busy={exporting === "tasks"} onClick={() => openExport("tasks")}>
            📄 הדפסת התשובות שלי מהמשימות
          </ExportButton>
        </div>
      )}
      {!readOnly && (
        <p className="mt-2 text-xs text-[color:var(--foreground)]/60">
          נפתח דף נקי. בחלון ההדפסה (גם בנייד) בוחרים ״שמירה כ־PDF״.
        </p>
      )}
    </section>
  );
}

function ExportButton({
  busy,
  onClick,
  primary,
  children,
}: {
  busy: boolean;
  onClick: () => void;
  primary?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition ${
        primary
          ? "bg-[color:var(--accent-fill)] text-white shadow"
          : "border-2 border-[color:var(--primary)]/50 text-[color:var(--primary)]"
      } ${busy ? "scale-[0.97] opacity-80" : "hover:scale-[1.02]"}`}
    >
      {busy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
      {busy ? "מכינה את הדף…" : children}
    </button>
  );
}
