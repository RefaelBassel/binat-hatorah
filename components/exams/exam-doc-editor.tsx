"use client";

import { useState } from "react";
import AutoTextarea from "./auto-textarea";
import SortableItem, { moveItem } from "./sortable";
import {
  type ExamDoc,
  type ExamPart,
  type ExamQuestion,
  type ExamSub,
  examTotal,
  newId,
  partMismatches,
  partTotal,
  questionPoints,
  subLabel,
} from "@/lib/exams-types";

function NumField({
  value,
  onChange,
  label,
  placeholder,
  width = "w-20",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--foreground)]/70">
      {label}
      <input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        dir="ltr"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className={`${width} rounded-md border border-[color:var(--border)] bg-[color:var(--field)] px-2 py-1 text-center text-sm outline-none focus:border-[color:var(--accent)]`}
      />
    </label>
  );
}

function RubricField({
  value,
  onChange,
  small = false,
}: {
  value: string;
  onChange: (v: string) => void;
  small?: boolean;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[color:var(--warning)]/60 bg-[color:var(--warning)]/10 p-2">
      <div className="mb-1 text-xs font-bold text-[color:var(--warning)]">
        🔒 תשובה לדוגמה / מחוון — רק המורה רואה (אפשר להשאיר ריק)
      </div>
      <AutoTextarea
        value={value}
        onChange={onChange}
        minRows={small ? 1 : 2}
        ariaLabel="תשובה לדוגמה / מחוון"
        placeholder="מה נחשב תשובה טובה, ואיך מתחלקים הנקודות…"
        className="text-sm leading-7"
      />
    </div>
  );
}

const iconBtn =
  "rounded-full border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1 text-xs font-bold text-[color:var(--primary)] hover:border-[color:var(--accent)]";
const delBtn =
  "rounded-full border border-[color:var(--danger)]/40 px-3 py-1 text-xs font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10";

export default function ExamDocEditor({
  doc,
  onChange,
}: {
  doc: ExamDoc;
  onChange: (d: ExamDoc) => void;
}) {
  const total = examTotal(doc);
  const mismatches = partMismatches(doc);
  const setParts = (parts: ExamPart[]) => onChange({ ...doc, parts });
  const patchPart = (i: number, patch: Partial<ExamPart>) =>
    setParts(doc.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)));

  // running question number across parts
  let counter = 0;
  const starts = doc.parts.map((p) => {
    const s = counter;
    counter += p.questions.length;
    return s;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <NumField
          label="זמן המבחן (בדקות)"
          value={doc.durationMin}
          onChange={(v) => onChange({ ...doc, durationMin: v === null ? null : Math.round(v) })}
          placeholder="90"
          width="w-24"
        />
        <div
          className={`rounded-xl px-4 py-2 text-sm font-bold ${
            total === 100
              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "bg-[color:var(--warning)]/20 text-[color:var(--warning)]"
          }`}
          role="status"
        >
          סך הכול: {total} נקודות
          {total !== 100 && <span> · ⚠ הסכום אינו 100</span>}
          {total === 100 && <span> ✓</span>}
        </div>
      </div>

      {doc.parts.map((part, pi) => {
        const mismatch = mismatches.find((m) => m.id === part.id);
        return (
          <SortableItem
            key={part.id}
            group="parts"
            index={pi}
            count={doc.parts.length}
            onMove={(from, to) => setParts(moveItem(doc.parts, from, to))}
            className="rounded-2xl border-2 border-[color:var(--primary)]/25 bg-[color:var(--card)] p-4"
          >
            {(controls) => (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  {controls}
                  <span className="font-display text-sm font-extrabold text-[color:var(--primary)]">
                    חלק {pi + 1}
                  </span>
                  <span className="text-xs font-semibold text-[color:var(--foreground)]/60">
                    {partTotal(part)} נקודות לפי השאלות
                  </span>
                  <button
                    type="button"
                    className={`${delBtn} ms-auto`}
                    onClick={() => {
                      if (
                        part.questions.length === 0 ||
                        window.confirm(`למחוק את החלק כולל ${part.questions.length} השאלות שבו?`)
                      ) {
                        setParts(doc.parts.filter((_, k) => k !== pi));
                      }
                    }}
                  >
                    מחיקת חלק
                  </button>
                </div>

                <input
                  dir="rtl"
                  lang="he"
                  value={part.title}
                  onChange={(e) => patchPart(pi, { title: e.target.value })}
                  placeholder="כותרת החלק (למשל: חלק א׳: ידע והבנת הטקסט)"
                  aria-label="כותרת החלק"
                  className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2 font-display text-lg font-bold outline-none focus:border-[color:var(--accent)]"
                />
                <AutoTextarea
                  value={part.instructions}
                  onChange={(v) => patchPart(pi, { instructions: v })}
                  placeholder="הנחיה לחלק (למשל: ענו על 4 מתוך 5 השאלות)"
                  ariaLabel="הנחיה לחלק"
                />
                <div className="flex flex-wrap items-center gap-4">
                  <NumField
                    label="ניקוד החלק"
                    value={part.points}
                    onChange={(v) => patchPart(pi, { points: v })}
                  />
                  <NumField
                    label="שאלות בחירה — לענות על"
                    value={part.answerCount}
                    onChange={(v) => patchPart(pi, { answerCount: v === null ? null : Math.round(v) })}
                    placeholder="הכול"
                    width="w-16"
                  />
                  <span className="text-xs text-[color:var(--foreground)]/60">
                    מתוך {part.questions.length} שאלות
                    {part.answerCount !== null &&
                      part.answerCount > 0 &&
                      part.answerCount < part.questions.length && (
                        <> · בחישוב הסכום נספרות {part.answerCount} השאלות עם הניקוד הגבוה</>
                      )}
                  </span>
                </div>
                {mismatch && (
                  <p className="rounded-lg bg-[color:var(--warning)]/15 px-3 py-2 text-xs font-bold text-[color:var(--warning)]">
                    ⚠ ניקוד החלק ({mismatch.declared}) שונה מסכום השאלות ({mismatch.actual}).
                  </p>
                )}

                <div className="space-y-3">
                  {part.questions.map((q, qi) => (
                    <QuestionEditor
                      key={q.id}
                      q={q}
                      number={starts[pi] + qi + 1}
                      index={qi}
                      count={part.questions.length}
                      group={`q:${part.id}`}
                      onMoveSelf={(from, to) =>
                        patchPart(pi, { questions: moveItem(part.questions, from, to) })
                      }
                      onChange={(nq) =>
                        patchPart(pi, {
                          questions: part.questions.map((x, k) => (k === qi ? nq : x)),
                        })
                      }
                      onDelete={() => {
                        if (
                          (!q.text && q.subs.length === 0) ||
                          window.confirm("למחוק את השאלה?")
                        ) {
                          patchPart(pi, { questions: part.questions.filter((_, k) => k !== qi) });
                        }
                      }}
                    />
                  ))}
                  <button
                    type="button"
                    className={iconBtn}
                    onClick={() =>
                      patchPart(pi, {
                        questions: [
                          ...part.questions,
                          { id: newId(), text: "", points: null, subs: [], footer: "", rubric: "" },
                        ],
                      })
                    }
                  >
                    + הוספת שאלה
                  </button>
                </div>
              </div>
            )}
          </SortableItem>
        );
      })}

      <button
        type="button"
        className="rounded-full bg-[color:var(--primary-fill)] px-5 py-2 text-sm font-bold text-white shadow-sm"
        onClick={() =>
          setParts([
            ...doc.parts,
            {
              id: newId(),
              title: "",
              instructions: "",
              points: null,
              answerCount: null,
              questions: [],
            },
          ])
        }
      >
        + הוספת חלק
      </button>
    </div>
  );
}

function QuestionEditor({
  q,
  number,
  index,
  count,
  group,
  onMoveSelf,
  onChange,
  onDelete,
}: {
  q: ExamQuestion;
  number: number;
  index: number;
  count: number;
  group: string;
  onMoveSelf: (from: number, to: number) => void;
  onChange: (q: ExamQuestion) => void;
  onDelete: () => void;
}) {
  const [showFooter, setShowFooter] = useState(q.footer.length > 0);
  const patch = (p: Partial<ExamQuestion>) => onChange({ ...q, ...p });
  const setSubs = (subs: ExamSub[]) => patch({ subs });
  const patchSub = (i: number, p: Partial<ExamSub>) =>
    setSubs(q.subs.map((s, k) => (k === i ? { ...s, ...p } : s)));

  return (
    <SortableItem
      group={group}
      index={index}
      count={count}
      onMove={onMoveSelf}
      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3"
    >
      {(controls) => (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-3">
            {controls}
            <span className="font-display text-base font-extrabold text-[color:var(--accent)]">
              שאלה {number}
            </span>
            <NumField
              label="ניקוד"
              value={q.points}
              onChange={(v) => patch({ points: v })}
              placeholder={q.subs.length ? String(questionPoints(q)) : ""}
            />
            <button type="button" className={`${delBtn} ms-auto`} onClick={onDelete}>
              מחיקת שאלה
            </button>
          </div>
          <AutoTextarea
            value={q.text}
            onChange={(v) => patch({ text: v })}
            minRows={2}
            placeholder="נוסח השאלה"
            ariaLabel={`נוסח שאלה ${number}`}
          />

          {q.subs.map((s, si) => (
            <SortableItem
              key={s.id}
              group={`s:${q.id}`}
              index={si}
              count={q.subs.length}
              onMove={(from, to) => setSubs(moveItem(q.subs, from, to))}
              className="me-0 ms-4 space-y-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] p-2.5"
            >
              {(sc) => (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    {sc}
                    <span className="text-sm font-extrabold text-[color:var(--primary)]">
                      סעיף {subLabel(si)}
                    </span>
                    <NumField
                      label="ניקוד"
                      value={s.points}
                      onChange={(v) => patchSub(si, { points: v })}
                    />
                    <button
                      type="button"
                      className={`${delBtn} ms-auto`}
                      onClick={() => setSubs(q.subs.filter((_, k) => k !== si))}
                    >
                      מחיקת סעיף
                    </button>
                  </div>
                  <AutoTextarea
                    value={s.text}
                    onChange={(v) => patchSub(si, { text: v })}
                    minRows={2}
                    placeholder="נוסח הסעיף"
                    ariaLabel={`נוסח סעיף ${subLabel(si)}`}
                  />
                  <RubricField value={s.rubric} onChange={(v) => patchSub(si, { rubric: v })} small />
                </>
              )}
            </SortableItem>
          ))}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={iconBtn}
              onClick={() => setSubs([...q.subs, { id: newId(), text: "", points: null, rubric: "" }])}
            >
              + הוספת סעיף
            </button>
            {!showFooter && (
              <button type="button" className={iconBtn} onClick={() => setShowFooter(true)}>
                + הערה בסוף השאלה
              </button>
            )}
          </div>

          {showFooter && (
            <AutoTextarea
              value={q.footer}
              onChange={(v) => patch({ footer: v })}
              placeholder="הערה שמופיעה אחרי הסעיפים"
              ariaLabel="הערה בסוף השאלה"
            />
          )}

          <RubricField
            value={q.rubric}
            onChange={(v) => patch({ rubric: v })}
            small={q.subs.length > 0}
          />
        </div>
      )}
    </SortableItem>
  );
}
