"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { TaskSection, QuestionBlock } from "@/content/tasks/types";
import type { WorksheetEdits, UnitEdits } from "@/lib/content-overrides";
import SaveButton from "@/components/save-button";

// The teacher's editor for every text of a task that is not the comprehension
// check, the plenary question or the opening deck (those have their own
// editors): the title line, the skill line, Part A's settings, and all of
// Part B — section titles and minutes, intro / case / source texts, art
// captions, and every question (label, wording, helper; hide, restore, add
// her own). The files stay the defaults; what she saves wins. The biblical
// text itself is never edited here.
type BlockEdit = { title?: string; body?: string; text?: string; caption?: string };

export interface UnitMeta {
  title: string;
  subtitle?: string;
  skill: string;
  bookRef: string;
  heroCaption?: string;
  genreOptions: string[];
  minQuestions: number;
}

function Field({
  label,
  value,
  original,
  onChange,
  rows = 2,
  onReset,
}: {
  label: string;
  value: string | undefined;
  original: string;
  onChange: (v: string) => void;
  rows?: number;
  onReset: () => void;
}) {
  return (
    <div className="mb-2">
      <label className="block text-[10px] font-semibold text-[color:var(--primary)]/55">{label}</label>
      <textarea
        value={value ?? original}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-0.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
      />
      {value != null && value !== original && (
        <button type="button" onClick={onReset} className="text-[10px] font-semibold text-[color:var(--primary)]/50 hover:text-[color:var(--accent)]">
          ↺ לנוסח המקורי
        </button>
      )}
    </div>
  );
}

export default function WorksheetEditor({
  contentRef,
  sections,
  edits,
  unitEdits,
  unitMeta,
  onClose,
}: {
  contentRef: string;
  sections: TaskSection[]; // the ORIGINAL file sections (so hidden questions can be restored)
  edits: WorksheetEdits;
  unitEdits: UnitEdits;
  unitMeta: UnitMeta; // the ORIGINAL file values of the title line and Part A settings
  onClose?: () => void;
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(edits.hidden));
  const [prompts, setPrompts] = useState<Record<string, string>>({ ...edits.prompts });
  const [labels, setLabels] = useState<Record<string, string>>({ ...(edits.labels ?? {}) });
  const [helpers, setHelpers] = useState<Record<string, string>>({ ...(edits.helpers ?? {}) });
  const [extra, setExtra] = useState(edits.extra.map((e) => ({ ...e })));
  const [secEdits, setSecEdits] = useState<UnitEdits["sections"]>({ ...unitEdits.sections });
  const [blockEdits, setBlockEdits] = useState<UnitEdits["blocks"]>({ ...unitEdits.blocks });
  const metaOf = (u: UnitEdits) => ({
    title: u.title ?? "",
    subtitle: u.subtitle ?? "",
    skill: u.skill ?? "",
    bookRef: u.bookRef ?? "",
    heroCaption: u.heroCaption ?? "",
    genre: (u.genreOptions ?? []).join(", "),
    minQuestions: u.minQuestions != null ? String(u.minQuestions) : "",
  });
  const [meta, setMeta] = useState(() => metaOf(unitEdits));

  const snap = (h: string[], p: unknown, l: unknown, hp: unknown, x: unknown, sx: unknown, b: unknown, m: unknown) =>
    JSON.stringify({ h: [...h].sort(), p, l, hp, x, s: sx, b, m });
  const [saved, setSaved] = useState(() =>
    snap(edits.hidden, edits.prompts, edits.labels ?? {}, edits.helpers ?? {}, edits.extra, unitEdits.sections, unitEdits.blocks, metaOf(unitEdits))
  );
  const current = snap([...hidden], prompts, labels, helpers, extra, secEdits, blockEdits, meta);
  const dirty = useMemo(() => current !== saved, [current, saved]);

  const putField = async (field: string, value: unknown) => {
    const res = await fetch("/api/content-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentRef, field, value }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "השמירה נכשלה");
    return data.value;
  };

  const clean = (r: Record<string, string>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v.trim()));
  const save = async () => {
    const ws: WorksheetEdits = {
      hidden: [...hidden],
      prompts: clean(prompts),
      labels: clean(labels),
      helpers: clean(helpers),
      extra: extra.filter((e) => e.prompt.trim()),
    };
    const genreOptions = meta.genre
      .split(/[,،\n]+/)
      .map((g) => g.trim())
      .filter(Boolean);
    const unit: Record<string, unknown> = {
      sections: secEdits,
      blocks: blockEdits,
      title: meta.title,
      subtitle: meta.subtitle,
      skill: meta.skill,
      bookRef: meta.bookRef,
      heroCaption: meta.heroCaption,
      ...(genreOptions.length >= 2 ? { genreOptions } : {}),
      ...(meta.minQuestions.trim() ? { minQuestions: Number(meta.minQuestions) } : {}),
    };
    const v = (await putField("worksheet", ws)) as WorksheetEdits;
    const u = (await putField("unit", unit)) as UnitEdits;
    setHidden(new Set(v.hidden));
    setPrompts(v.prompts);
    setLabels(v.labels ?? {});
    setHelpers(v.helpers ?? {});
    setExtra(v.extra);
    setSecEdits(u.sections);
    setBlockEdits(u.blocks);
    setMeta(metaOf(u));
    setSaved(snap(v.hidden, v.prompts, v.labels ?? {}, v.helpers ?? {}, v.extra, u.sections, u.blocks, metaOf(u)));
    router.refresh();
  };

  const toggleHidden = (key: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  const setSec = (key: string, patch: { title?: string; minutes?: number }) => setSecEdits((s) => ({ ...s, [key]: { ...(s[key] ?? {}), ...patch } }));
  const setBlock = (key: string, patch: BlockEdit) => setBlockEdits((b) => ({ ...b, [key]: { ...(b[key] ?? {}), ...patch } }));
  const dropKey = (set: (f: (r: Record<string, string>) => Record<string, string>) => void, key: string) =>
    set((r) => {
      const n = { ...r };
      delete n[key];
      return n;
    });

  return (
    <div className="rounded-2xl border-2 border-[color:var(--primary)]/30 bg-[color:var(--card)] p-5" dir="rtl">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold text-[color:var(--primary)]">✏️ עריכת כל הטקסטים והשאלות</p>
          <p className="text-xs text-[color:var(--foreground)]/60">
            כל טקסט כאן ניתן לשינוי. שאלה אפשר להסתיר (היא נשארת אפורה ואפשר להחזיר) או להוסיף משלך. מה שתשמרי הוא מה שהתלמידות
            יראו. הפסוקים עצמם לא נערכים.
          </p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]">
            סגירת העריכה
          </button>
        )}
      </div>

      {/* the title line + Part A settings */}
      <div className="mb-5 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
        <p className="mb-2 text-[11px] font-bold text-[color:var(--accent)]">כותרת המשימה (גם השקף הראשון של אור פותח)</p>
        <Field label="כותרת" value={meta.title || undefined} original={unitMeta.title} rows={1} onChange={(v) => setMeta((m) => ({ ...m, title: v }))} onReset={() => setMeta((m) => ({ ...m, title: "" }))} />
        <Field label="תת-כותרת" value={meta.subtitle || undefined} original={unitMeta.subtitle ?? ""} rows={1} onChange={(v) => setMeta((m) => ({ ...m, subtitle: v }))} onReset={() => setMeta((m) => ({ ...m, subtitle: "" }))} />
        <Field label="ספר, פרק ופסוקים" value={meta.bookRef || undefined} original={unitMeta.bookRef} rows={1} onChange={(v) => setMeta((m) => ({ ...m, bookRef: v }))} onReset={() => setMeta((m) => ({ ...m, bookRef: "" }))} />
        <Field label="🎯 מיומנויות מרכזיות" value={meta.skill || undefined} original={unitMeta.skill} rows={1} onChange={(v) => setMeta((m) => ({ ...m, skill: v }))} onReset={() => setMeta((m) => ({ ...m, skill: "" }))} />
        {unitMeta.heroCaption != null && (
          <Field label="כיתוב לאיור הפתיחה (חלק א, מפגש ראשון)" value={meta.heroCaption || undefined} original={unitMeta.heroCaption} rows={2} onChange={(v) => setMeta((m) => ({ ...m, heroCaption: v }))} onReset={() => setMeta((m) => ({ ...m, heroCaption: "" }))} />
        )}
        <p className="mb-2 mt-3 text-[11px] font-bold text-[color:var(--accent)]">הגדרות חלק א (פענוח הפשט)</p>
        <Field label="אפשרויות הסוגה, מופרדות בפסיקים" value={meta.genre || undefined} original={unitMeta.genreOptions.join(", ")} rows={1} onChange={(v) => setMeta((m) => ({ ...m, genre: v }))} onReset={() => setMeta((m) => ({ ...m, genre: "" }))} />
        <div className="w-40">
          <label className="block text-[10px] font-semibold text-[color:var(--primary)]/55">מינימום שאלות בשלב שאילת השאלות</label>
          <input
            type="number"
            min={1}
            max={10}
            value={meta.minQuestions || unitMeta.minQuestions}
            onChange={(e) => setMeta((m) => ({ ...m, minQuestions: e.target.value }))}
            className="mt-0.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
          />
        </div>
      </div>

      <p className="mb-2 text-[11px] font-bold text-[color:var(--accent)]">חלק ב — העמקה ודיון</p>
      <div className="space-y-5">
        {sections.map((sec) => {
          const mine = extra.filter((e) => e.sectionKey === sec.key);
          const se = secEdits[sec.key] ?? {};
          let qIndex = 0;
          return (
            <div key={sec.key} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
              <div className="mb-3 flex flex-wrap items-end gap-2">
                <div className="min-w-0 flex-1">
                  <label className="block text-[10px] font-semibold text-[color:var(--primary)]/55">כותרת הפרק בדף העבודה</label>
                  <input
                    value={se.title ?? sec.title}
                    onChange={(e) => setSec(sec.key, { title: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm font-bold outline-none focus:border-[color:var(--accent)]"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-[10px] font-semibold text-[color:var(--primary)]/55">~דקות</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={se.minutes ?? sec.minutes ?? ""}
                    onChange={(e) => setSec(sec.key, { minutes: Number(e.target.value) || undefined })}
                    className="mt-0.5 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
                  />
                </div>
              </div>

              <ul className="space-y-2">
                {sec.blocks.map((b) => {
                  if (b.type === "question") {
                    const q = b as QuestionBlock;
                    qIndex += 1;
                    const off = hidden.has(q.key);
                    return (
                      <li key={q.key} className={`rounded-xl border p-3 transition ${off ? "border-dashed border-[color:var(--border)] bg-[color:var(--card)] opacity-60" : "border-[color:var(--border)] bg-[color:var(--card)]"}`}>
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-[color:var(--primary)]/60">
                            שאלה {qIndex}
                            {off && " · מוסתרת"}
                          </span>
                          <button type="button" onClick={() => toggleHidden(q.key)} className={`rounded-full px-3 py-0.5 text-[11px] font-bold transition ${off ? "bg-[color:var(--success)] text-white" : "border border-[color:var(--danger)]/50 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"}`}>
                            {off ? "↩ להחזיר" : "להסתיר"}
                          </button>
                        </div>
                        {!off && (
                          <>
                            <Field label="התווית שמעל השאלה" value={labels[q.key]} original={q.label} rows={1} onChange={(v) => setLabels((r) => ({ ...r, [q.key]: v }))} onReset={() => dropKey(setLabels, q.key)} />
                            <Field label="נוסח השאלה" value={prompts[q.key]} original={q.prompt} rows={3} onChange={(v) => setPrompts((r) => ({ ...r, [q.key]: v }))} onReset={() => dropKey(setPrompts, q.key)} />
                            <Field label="שורת עזר קטנה (לא חובה)" value={helpers[q.key]} original={q.helper ?? ""} rows={1} onChange={(v) => setHelpers((r) => ({ ...r, [q.key]: v }))} onReset={() => dropKey(setHelpers, q.key)} />
                            {q.fields && q.fields.length > 0 && (
                              <p className="text-[10px] text-[color:var(--primary)]/45">
                                לשאלה יש {q.fields.length} שדות תשובה ({q.fields.map((f) => f.label).join(" · ")}) — הם נשארים.
                              </p>
                            )}
                          </>
                        )}
                      </li>
                    );
                  }
                  const be = blockEdits[b.key] ?? {};
                  const reset = (k: keyof BlockEdit) =>
                    setBlockEdits((all) => {
                      const n = { ...all };
                      const e = { ...(n[b.key] ?? {}) };
                      delete e[k];
                      if (Object.keys(e).length) n[b.key] = e;
                      else delete n[b.key];
                      return n;
                    });
                  if (b.type === "intro" || b.type === "case") {
                    return (
                      <li key={b.key} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                        <p className="mb-1 text-[11px] font-bold text-[color:var(--primary)]/60">{b.type === "intro" ? "📝 טקסט פתיחה" : "🎭 מקרה / דילמה"}</p>
                        {(b.title || b.type === "case") && (
                          <Field label="כותרת" value={be.title} original={b.title ?? ""} rows={1} onChange={(v) => setBlock(b.key, { title: v })} onReset={() => reset("title")} />
                        )}
                        <Field label="הטקסט" value={be.body} original={b.body} rows={4} onChange={(v) => setBlock(b.key, { body: v })} onReset={() => reset("body")} />
                      </li>
                    );
                  }
                  if (b.type === "source") {
                    return (
                      <li key={b.key} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                        <p className="mb-1 text-[11px] font-bold text-[color:var(--primary)]/60">📜 מקור</p>
                        <Field label="כותרת המקור" value={be.title} original={b.title} rows={1} onChange={(v) => setBlock(b.key, { title: v })} onReset={() => reset("title")} />
                        <Field label="הטקסט" value={be.text} original={b.text} rows={4} onChange={(v) => setBlock(b.key, { text: v })} onReset={() => reset("text")} />
                      </li>
                    );
                  }
                  if (b.type === "art") {
                    return (
                      <li key={b.key} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
                        <p className="mb-1 text-[11px] font-bold text-[color:var(--primary)]/60">🎨 כיתוב לאיור</p>
                        <Field label="הכיתוב" value={be.caption} original={b.caption ?? ""} rows={2} onChange={(v) => setBlock(b.key, { caption: v })} onReset={() => reset("caption")} />
                      </li>
                    );
                  }
                  return null; // passages: the biblical text itself is never edited
                })}
                {mine.map((e) => (
                  <li key={e.key} className="rounded-xl border border-[color:var(--accent)]/50 bg-[color:var(--accent)]/5 p-3">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-[color:var(--accent)]">✨ שאלה שלך</span>
                      <button type="button" onClick={() => setExtra((x) => x.filter((y) => y.key !== e.key))} className="rounded-full border border-[color:var(--danger)]/50 px-3 py-0.5 text-[11px] font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10">
                        למחוק
                      </button>
                    </div>
                    <textarea
                      value={e.prompt}
                      onChange={(ev) => setExtra((x) => x.map((y) => (y.key === e.key ? { ...y, prompt: ev.target.value } : y)))}
                      rows={2}
                      placeholder="נוסח השאלה…"
                      className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
                    />
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => setExtra((x) => [...x, { sectionKey: sec.key, key: `t-${sec.key}-${Date.now().toString(36)}`, prompt: "", label: "שאלה של המורה", icon: "thinking" }])}
                className="mt-2 w-full rounded-xl border-2 border-dashed border-[color:var(--border)] py-2 text-xs font-bold text-[color:var(--primary)]/70 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                + שאלה משלך לפרק הזה
              </button>
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-2 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)]/95 px-3 py-3 shadow-lg backdrop-blur">
        <SaveButton dirty={dirty} onSave={save} />
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("לבטל את כל עריכות הטקסטים והשאלות של המשימה ולחזור לנוסח המקורי? (בדיקת ההבנה, שאלת המליאה ואור פותח נשארים)")) return;
            for (const field of ["worksheet", "unit"]) {
              await fetch("/api/content-overrides", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentRef, field, reset: true }),
              });
            }
            router.refresh();
            onClose?.();
          }}
          className="text-xs font-semibold text-[color:var(--primary)]/50 hover:text-[color:var(--danger)]"
        >
          ↺ לנוסח המקורי של כל הטקסטים
        </button>
      </div>
    </div>
  );
}
