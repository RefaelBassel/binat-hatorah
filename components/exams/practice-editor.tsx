"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SaveButton from "@/components/save-button";
import { newId } from "@/lib/exam-types";
import type { Flashcard, OpenPracticeQuestion, PracticeUnit } from "@/lib/practice-types";

// Teacher: the practice settings in the exam editor (issue #34) — which units
// the practice covers, the flash cards, the open questions, and opening the
// practice to students (closed by default).

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60";
const ghost = `${btn} border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:bg-[color:var(--border)]/40`;
const field =
  "w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] p-2 text-sm focus:border-[color:var(--primary)] focus:outline-none";

export default function PracticeEditor({
  examId,
  allUnits,
  initialUnits,
  initialCards,
  cardsAuto,
  initialOpen,
  openAuto,
  openedAt,
}: {
  examId: number;
  allUnits: PracticeUnit[];
  initialUnits: string[];
  initialCards: Flashcard[];
  cardsAuto: boolean;
  initialOpen: OpenPracticeQuestion[];
  openAuto: boolean;
  openedAt: number | null;
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
  const [cards, setCards] = useState(initialCards);
  const [cardsEdited, setCardsEdited] = useState(!cardsAuto);
  const [questions, setQuestions] = useState(initialOpen);
  const [openEdited, setOpenEdited] = useState(!openAuto);
  const [dirty, setDirty] = useState(false);
  const [isOpen, setIsOpen] = useState(openedAt != null);
  const [toggling, setToggling] = useState(false);
  const [toggleMsg, setToggleMsg] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const titles = new Map(allUnits.map((u) => [u.ref, u.title]));
  const chosen = allUnits.filter((u) => units.includes(u.ref));

  const touchCards = (next: Flashcard[]) => {
    setCards(next);
    setCardsEdited(true);
    setDirty(true);
  };
  const touchQuestions = (next: OpenPracticeQuestion[]) => {
    setQuestions(next);
    setOpenEdited(true);
    setDirty(true);
  };

  const save = async () => {
    const res = await fetch(`/api/exams/${examId}/practice/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        settings: {
          units: allUnits.map((u) => u.ref).filter((r) => units.includes(r)),
          cards: cardsEdited ? cards : null,
          openQuestions: openEdited ? questions : null,
        },
      }),
    }).catch(() => null);
    if (!res?.ok) throw new Error(((await res?.json().catch(() => null)) as { error?: string } | null)?.error || "לא נשמר — נסו שוב");
    setDirty(false);
    router.refresh();
  };

  const toggle = async () => {
    const next = !isOpen;
    if (next && dirty && !window.confirm("יש שינויים שלא נשמרו. לפתוח את התרגול בלי לשמור אותם?")) return;
    setToggling(true);
    setToggleMsg(null);
    const res = await fetch(`/api/exams/${examId}/practice/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: next ? "open" : "close" }),
    }).catch(() => null);
    setToggling(false);
    if (res?.ok) {
      setIsOpen(next);
      setToggleMsg(next ? "✓ התרגול נפתח לתלמידות" : "✓ התרגול נסגר");
      setTimeout(() => setToggleMsg(null), 2500);
      router.refresh();
    } else setToggleMsg("הפעולה נכשלה — נסו שוב");
  };

  const suggest = async () => {
    if (cards.length > 0 && !window.confirm("קלוד יכין רשימת כרטיסיות חדשה שתחליף את הרשימה הנוכחית (עדיין לא נשמרת). להמשיך?")) return;
    setSuggesting(true);
    setSuggestMsg(null);
    const res = await fetch(`/api/exams/${examId}/practice/settings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "suggest-cards", units }),
    }).catch(() => null);
    const data = (res ? await res.json().catch(() => null) : null) as { cards?: Flashcard[]; error?: string } | null;
    setSuggesting(false);
    if (res?.ok && data?.cards) {
      touchCards(data.cards);
      setSuggestMsg(`✓ ${data.cards.length} כרטיסיות מוכנות לעריכה. אל תשכחו לשמור.`);
    } else setSuggestMsg(data?.error || "לא הצליח — נסו שוב");
  };

  const unitSelect = (value: string, onChange: (v: string) => void) => (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`${field} sm:w-44`} aria-label="יחידה">
      <option value="">כללי</option>
      {chosen.map((u) => (
        <option key={u.ref} value={u.ref}>
          {u.title}
        </option>
      ))}
    </select>
  );

  return (
    <section id="practice" className="mx-auto mt-10 max-w-4xl scroll-mt-24 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">📚 תרגול למבחן לתלמידות</h2>
          <p className="text-xs text-[color:var(--foreground)]/65">
            חידון מהיר, כרטיסיות זיכרון, שאלות פתוחות עם משוב מקלוד ומבחן לדוגמה. לא נכנס לדוח הציונים.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold text-white ${isOpen ? "bg-[color:var(--success-fill)]" : "bg-[color:var(--foreground)]/50"}`}
          >
            {isOpen ? "פתוח לתלמידות" : "סגור"}
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={toggling}
            className={`${btn} px-5 py-2 text-sm text-white shadow ${isOpen ? "bg-[color:var(--danger-fill)]" : "bg-[color:var(--accent-fill)]"} ${toggling ? "scale-[0.96]" : "hover:scale-[1.03]"}`}
          >
            {toggling && <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
            {toggling ? (isOpen ? "סוגר…" : "פותח…") : isOpen ? "סגירת התרגול" : "פתיחת התרגול לתלמידים"}
          </button>
          <a href={`/exams/practice/${examId}`} className={ghost}>
            👁 תצוגה מקדימה
          </a>
        </div>
      </div>
      {toggleMsg && <p className="mb-3 text-sm font-bold text-[color:var(--success)]" aria-live="polite">{toggleMsg}</p>}

      <h3 className="mb-2 mt-4 font-bold text-[color:var(--primary)]">היחידות שהתרגול מכסה</h3>
      <div className="flex flex-wrap gap-2">
        {allUnits.map((u) => {
          const on = units.includes(u.ref);
          return (
            <label
              key={u.ref}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                on ? "border-[color:var(--primary)] bg-[color:var(--primary)]/12 text-[color:var(--primary)]" : "border-[color:var(--border)]"
              }`}
              title={u.chapters}
            >
              <input
                type="checkbox"
                checked={on}
                onChange={() => {
                  setUnits(on ? units.filter((x) => x !== u.ref) : [...units, u.ref]);
                  setDirty(true);
                }}
                className="accent-[color:var(--primary)]"
              />
              {u.ref.replace("lesson-", "יחידה ")} · {u.title}
            </label>
          );
        })}
      </div>

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-[color:var(--primary)]">
          כרטיסיות זיכרון ({cards.length}){!cardsEdited && <span className="text-xs font-normal"> · נוצרו אוטומטית מהמקורות</span>}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} disabled={suggesting || units.length === 0} onClick={suggest}>
            {suggesting && <span aria-hidden className="h-3 w-3 animate-spin rounded-full border-2 border-[color:var(--primary)]/30 border-t-[color:var(--primary)]" />}
            {suggesting ? "קלוד מכין…" : "✨ ניסוח כרטיסיות עם קלוד"}
          </button>
          <button type="button" className={ghost} onClick={() => touchCards([...cards, { id: newId(), unitRef: chosen[0]?.ref ?? "", front: "", back: "" }])}>
            + כרטיס
          </button>
          {cardsEdited && (
            <button
              type="button"
              className={ghost}
              onClick={() => {
                if (!window.confirm("לחזור לכרטיסיות האוטומטיות? העריכות יימחקו אחרי השמירה.")) return;
                setCardsEdited(false);
                setDirty(true);
              }}
            >
              חזרה לאוטומטי
            </button>
          )}
        </div>
      </div>
      {suggestMsg && <p className="mb-2 text-xs font-bold text-[color:var(--accent)]" aria-live="polite">{suggestMsg}</p>}
      {!cardsEdited && dirty && <p className="mb-2 text-xs">הכרטיסיות האוטומטיות יתעדכנו לפי היחידות אחרי השמירה.</p>}
      <ul className="max-h-[32rem] space-y-2 overflow-y-auto pl-1">
        {cards.map((c, i) => (
          <li key={c.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              {unitSelect(c.unitRef, (v) => touchCards(cards.map((x, j) => (j === i ? { ...x, unitRef: v } : x))))}
              <input
                value={c.front}
                onChange={(e) => touchCards(cards.map((x, j) => (j === i ? { ...x, front: e.target.value } : x)))}
                className={field}
                placeholder="צד ראשון (למשל: רש״י על במדבר ט״ז, א׳ — מה הוא אומר?)"
                aria-label="צד ראשון"
              />
              <button
                type="button"
                onClick={() => touchCards(cards.filter((_, j) => j !== i))}
                className="shrink-0 rounded-lg px-2 text-sm text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                aria-label="מחיקת הכרטיס"
              >
                🗑
              </button>
            </div>
            <textarea
              value={c.back}
              onChange={(e) => touchCards(cards.map((x, j) => (j === i ? { ...x, back: e.target.value } : x)))}
              rows={2}
              className={`${field} mt-2`}
              placeholder="צד שני: עיקר הדברים במשפט אחד"
              aria-label="צד שני"
            />
          </li>
        ))}
      </ul>

      <div className="mb-2 mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-[color:var(--primary)]">
          שאלות פתוחות לתרגול ({questions.length})
          {!openEdited && <span className="text-xs font-normal"> · מדף ההכנה ומשאלות הטיעון ביחידות</span>}
        </h3>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={ghost} onClick={() => touchQuestions([...questions, { id: newId(), unitRef: "", text: "" }])}>
            + שאלה
          </button>
          {openEdited && (
            <button
              type="button"
              className={ghost}
              onClick={() => {
                if (!window.confirm("לחזור לרשימה האוטומטית? העריכות יימחקו אחרי השמירה.")) return;
                setOpenEdited(false);
                setDirty(true);
              }}
            >
              חזרה לאוטומטי
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {questions.map((q, i) => (
          <li key={q.id} className="flex flex-col gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-2 sm:flex-row">
            {unitSelect(q.unitRef, (v) => touchQuestions(questions.map((x, j) => (j === i ? { ...x, unitRef: v } : x))))}
            <textarea
              value={q.text}
              onChange={(e) => touchQuestions(questions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
              rows={2}
              className={field}
              aria-label="נוסח השאלה"
            />
            <button
              type="button"
              onClick={() => touchQuestions(questions.filter((_, j) => j !== i))}
              className="shrink-0 rounded-lg px-2 text-sm text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
              aria-label="מחיקת השאלה"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-xs text-[color:var(--foreground)]/65">
        החידון המהיר נשלף מבדיקות ההבנה של היחידות שנבחרו ({chosen.map((u) => titles.get(u.ref)).join(", ") || "אין"}), בנוסח הנוכחי שלהן.
        המבחן לדוגמה נבנה באותו מבנה של המבחן, משאלות דף העבודה של היחידות.
      </p>
      <SaveButton dirty={dirty} onSave={save} className="mt-4 justify-center" />
    </section>
  );
}
