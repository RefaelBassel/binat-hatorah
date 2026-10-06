"use client";

import { useState } from "react";
import type { EssayExercise } from "@/content/writing/essays";
import type { WritingEdits } from "@/lib/content-overrides";
import type { TaskSection } from "@/content/tasks/types";

// The teacher edits a writing practice in place: the question, the article
// (title, byline, every paragraph), the three stands, the hints, the minimum
// length. Students never see this. Saved as one override ("writing") on the
// practice's content ref; "back to the original" clears it. The step field
// labels are edited through the same worksheet mechanism as any task, via
// the content page — here we keep to the practice's own texts.

type Draft = {
  title: string;
  question: string;
  sourceTitle: string;
  byline: string;
  paragraphs: string[];
  claimHint: string;
  reasonsHint: string;
  assumptionHint: string;
  stands: string[];
  lifeHint: string;
  counterHint: string;
  minWords: string;
};

function toDraft(ex: EssayExercise, w: WritingEdits): Draft {
  return {
    title: w.title ?? ex.title,
    question: w.question ?? ex.question,
    sourceTitle: w.sourceTitle ?? ex.source.title,
    byline: w.byline ?? ex.source.byline,
    paragraphs: w.paragraphs?.length ? w.paragraphs : ex.source.paragraphs,
    claimHint: w.analysisHints?.claim ?? ex.analysisHints.claim,
    reasonsHint: w.analysisHints?.reasons ?? ex.analysisHints.reasons,
    assumptionHint: w.analysisHints?.assumption ?? ex.analysisHints.assumption,
    stands: w.stands?.length ? w.stands : ex.stands,
    lifeHint: w.lifeHint ?? ex.lifeHint,
    counterHint: w.counterHint ?? ex.counterHint,
    minWords: String(w.minWords ?? ex.minWords),
  };
}

export default function EssayEditor({ contentRef, original, edits, sections }: { contentRef: string; original: EssayExercise; edits: WritingEdits; sections: TaskSection[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => toDraft(original, edits));
  const [saved, setSaved] = useState<Draft>(() => toDraft(original, edits));
  const [state, setState] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const edited = Object.keys(edits).length > 0;
  void sections;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setState("working");
    setError(null);
    try {
      const value: WritingEdits = {
        title: draft.title,
        question: draft.question,
        sourceTitle: draft.sourceTitle,
        byline: draft.byline,
        paragraphs: draft.paragraphs.map((p) => p.trim()).filter(Boolean),
        analysisHints: { claim: draft.claimHint, reasons: draft.reasonsHint, assumption: draft.assumptionHint },
        stands: draft.stands.map((s) => s.trim()).filter(Boolean),
        lifeHint: draft.lifeHint,
        counterHint: draft.counterHint,
        minWords: Number(draft.minWords) || original.minWords,
      };
      const r = await fetch("/api/content-overrides", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentRef, field: "writing", value }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? "השמירה נכשלה");
      setSaved(draft);
      setState("done");
      window.setTimeout(() => setState("idle"), 1800);
      window.setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      setState("error");
      setError(e instanceof Error ? e.message : "השמירה נכשלה");
    }
  };
  const reset = async () => {
    if (!window.confirm("לחזור לנוסח המקורי של התרגול? כל השינויים שלך בתרגול הזה יימחקו.")) return;
    setState("working");
    try {
      await fetch("/api/content-overrides", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contentRef, field: "writing", reset: true }) });
      window.location.reload();
    } finally {
      setState("idle");
    }
  };

  const area = (label: string, value: string, onChange: (v: string) => void, rows = 2) => (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[color:var(--primary)]/70">{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]" />
    </label>
  );

  return (
    <section className="mb-6 rounded-2xl border-2 border-dashed border-[color:var(--accent)]/50 bg-[color:var(--card)]" dir="rtl">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start" aria-expanded={open}>
        <span className="font-display text-base font-extrabold text-[color:var(--primary)]">
          ✏️ עריכת התרגול {edited && <span className="ms-2 rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] text-[color:var(--accent)]">נערך</span>}
        </span>
        <span className="text-xs font-bold text-[color:var(--primary)]/60">{open ? "▲ לסגור" : "▼ לפתוח — השאלה, הטקסט, העמדות והרמזים"}</span>
      </button>
      {open && (
        <div className="space-y-4 border-t border-[color:var(--border)] px-4 pb-4 pt-4">
          <p className="text-xs leading-5 text-[color:var(--primary)]/60">כל טקסט כאן הוא מה שהתלמידים יראו. השינויים נשמרים לתרגול הזה בלבד, ואפשר תמיד לחזור לנוסח המקורי. את כותרות השדות של השלבים אפשר לערוך ב״עריכת התוכן״ בדשבורד.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {area("שם התרגול", draft.title, (v) => set("title", v), 1)}
            {area("השאלה שעליה כותבים", draft.question, (v) => set("question", v), 2)}
          </div>
          <div className="rounded-xl bg-[color:var(--background)] p-3">
            <p className="mb-2 text-xs font-extrabold text-[color:var(--primary)]">📖 הטקסט לקריאה</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {area("כותרת", draft.sourceTitle, (v) => set("sourceTitle", v), 1)}
              {area("שורת המקור (מי כתב, איפה)", draft.byline, (v) => set("byline", v), 1)}
            </div>
            <div className="mt-3 space-y-2">
              {draft.paragraphs.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-center text-[11px] font-bold text-[color:var(--primary)]/50">{i + 1}</span>
                  <textarea value={p} onChange={(e) => set("paragraphs", draft.paragraphs.map((x, j) => (j === i ? e.target.value : x)))} rows={3} className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]" />
                  <button type="button" onClick={() => set("paragraphs", draft.paragraphs.filter((_, j) => j !== i))} aria-label="למחוק פסקה" className="mt-1 shrink-0 text-xs text-[color:var(--primary)]/40 hover:text-[color:var(--danger)]">✕</button>
                </div>
              ))}
              <button type="button" onClick={() => set("paragraphs", [...draft.paragraphs, ""])} className="rounded-full border border-dashed border-[color:var(--border)] px-3 py-1 text-xs font-bold text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]">＋ פסקה</button>
            </div>
          </div>
          <div className="rounded-xl bg-[color:var(--background)] p-3">
            <p className="mb-2 text-xs font-extrabold text-[color:var(--primary)]">🧩 רמזים לפירוק הטיעון</p>
            <div className="space-y-2">
              {area("רמז לטענה", draft.claimHint, (v) => set("claimHint", v))}
              {area("רמז לנימוקים", draft.reasonsHint, (v) => set("reasonsHint", v))}
              {area("רמז להנחה הסמויה", draft.assumptionHint, (v) => set("assumptionHint", v))}
            </div>
          </div>
          <div className="rounded-xl bg-[color:var(--background)] p-3">
            <p className="mb-2 text-xs font-extrabold text-[color:var(--primary)]">📌 שלוש העמדות לבחירה</p>
            <div className="space-y-2">
              {draft.stands.map((s, i) => (
                <input key={i} value={s} onChange={(e) => set("stands", draft.stands.map((x, j) => (j === i ? e.target.value : x)))} className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]" />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {area("🌍 רמז לראיה מהחיים", draft.lifeHint, (v) => set("lifeHint", v), 3)}
            {area("🥊 רמז לצד השני", draft.counterHint, (v) => set("counterHint", v), 3)}
          </div>
          <label className="block w-40">
            <span className="mb-1 block text-xs font-bold text-[color:var(--primary)]/70">מינימום מילים לפסקה</span>
            <input type="number" min={30} max={600} value={draft.minWords} onChange={(e) => set("minWords", e.target.value)} className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]" />
          </label>
          {error && <p className="text-xs font-bold text-[color:var(--danger)]">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={!dirty || state === "working"}
              onClick={save}
              className={`rounded-full px-6 py-2 text-sm font-extrabold text-white shadow transition-all duration-300 active:scale-95 disabled:opacity-40 ${state === "working" ? "animate-pulse" : ""}`}
              style={{ background: state === "done" ? "var(--success)" : "var(--accent)" }}
            >
              {state === "done" ? "נשמר ✓" : state === "working" ? "שומרים…" : dirty ? "שמירה — זה מה שהתלמידים יראו" : "אין שינויים"}
            </button>
            {edited && (
              <button type="button" disabled={state === "working"} onClick={reset} className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-bold text-[color:var(--primary)]/70 hover:border-[color:var(--danger)] hover:text-[color:var(--danger)]">
                ↺ לנוסח המקורי
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
