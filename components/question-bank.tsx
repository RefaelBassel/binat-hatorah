"use client";

import { useState } from "react";

// The personal question bank list with the mini-seminar chooser: the student
// stars favorites and picks ONE question that will grow into her final work.
export default function QuestionBank({
  initial,
}: {
  initial: { id: number; question: string; starred: boolean; chosen: boolean }[];
}) {
  const [questions, setQuestions] = useState(initial);

  const choose = async (id: number) => {
    setQuestions((qs) => qs.map((q) => ({ ...q, chosen: q.id === id })));
    await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, chosenForSeminar: true }),
    }).catch(() => {});
  };

  const star = async (id: number, starred: boolean) => {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, starred } : q)));
    await fetch("/api/questions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, starred }),
    }).catch(() => {});
  };

  if (questions.length === 0) {
    return (
      <p className="text-xs leading-6 text-[color:var(--foreground)]/55">
        כל שאלה ששואלים במשימות נאספת לכאן. בסוף השנה בוחרים מכאן שאלה אחת
        שמעניינת אותך במיוחד — והיא תהפוך לעבודה אישית שלך 🌟
      </p>
    );
  }

  return (
    <ul className="max-h-64 space-y-1.5 overflow-y-auto">
      {questions.map((q) => (
        <li
          key={q.id}
          className={[
            "flex items-start gap-2 rounded-lg px-3 py-1.5 text-xs leading-5",
            q.chosen
              ? "bg-[color:var(--accent)]/15 font-semibold"
              : "bg-[color:var(--primary)]/5",
          ].join(" ")}
        >
          <button
            onClick={() => star(q.id, !q.starred)}
            title={q.starred ? "הסרת סימון" : "סימון כמועדפת"}
            className="mt-0.5 shrink-0"
          >
            {q.starred ? "⭐" : "☆"}
          </button>
          <span className="flex-1">{q.question}</span>
          {q.chosen ? (
            <span className="shrink-0 rounded-full bg-[color:var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white">
              🌟 למיני-סמינריון
            </span>
          ) : (
            <button
              onClick={() => choose(q.id)}
              className="shrink-0 rounded-full border border-[color:var(--border)] px-2 py-0.5 text-[10px] text-[color:var(--primary)]/60 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              בחירה לעבודה
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
