"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { requestGradeProposal } from "@/lib/grade-assist-client";

type Item = {
  taskId: number;
  userId: number;
  taskTitle: string;
  studentName: string;
  hasProposal: boolean;
};
type ItemState = "waiting" | "running" | "done" | "failed";

// A few at a time: fast enough to finish a class's backlog in one sitting,
// gentle enough not to trip the API's per-minute rate limit.
const CONCURRENCY = 3;

const keyOf = (i: Item) => `${i.taskId}:${i.userId}`;

// Teacher-only: asks Claude for a score + feedback proposal on every
// submission that has no approved grade and no proposal yet. Proposals are
// saved as drafts — nothing reaches a student until the teacher approves.
export default function BatchGradeAssist({ items }: { items: Item[] }) {
  const [states, setStates] = useState<Record<string, ItemState>>(() =>
    Object.fromEntries(items.map((i) => [keyOf(i), i.hasProposal ? "done" : "waiting"]))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [stopping, setStopping] = useState(false);
  const stopRef = useRef(false);

  const count = (s: ItemState) => items.filter((i) => states[keyOf(i)] === s).length;
  const done = count("done");
  const failed = count("failed");
  const remaining = count("waiting") + failed;
  const preexisting = items.filter((i) => i.hasProposal).length;

  const run = async (onlyFailed: boolean) => {
    const queue = items.filter((i) => {
      const s = states[keyOf(i)];
      return onlyFailed ? s === "failed" : s === "waiting" || s === "failed";
    });
    if (queue.length === 0) return;
    stopRef.current = false;
    setStopping(false);
    setRunning(true);
    const worker = async () => {
      while (!stopRef.current) {
        const item = queue.shift();
        if (!item) return;
        const k = keyOf(item);
        setStates((s) => ({ ...s, [k]: "running" }));
        const result = await requestGradeProposal(item.taskId, item.userId);
        // A non-retryable failure (bad key, no credit, wrong model) would hit
        // every remaining submission the same way — stop instead.
        if (!result.ok && !result.retryable) stopRef.current = true;
        setStates((s) => ({ ...s, [k]: result.ok ? "done" : "failed" }));
        setErrors((e) => {
          const next = { ...e };
          if (result.ok) delete next[k];
          else next[k] = result.error;
          return next;
        });
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    setRunning(false);
    setStopping(false);
  };

  const stop = () => {
    stopRef.current = true;
    setStopping(true);
  };

  if (items.length === 0) return null;
  const pct = Math.round((done / items.length) * 100);

  return (
    <div className="mb-8 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-6">
      <h2 className="mb-2 font-display text-lg font-bold text-[color:var(--primary)]">
        ✨ הצעות ציון של קלוד להגשות שעדיין אין להן ציון
      </h2>
      <p className="mb-4 text-sm leading-6 text-[color:var(--foreground)]/70">
        {items.length} הגשות עדיין לא קיבלו ציון מאושר
        {preexisting > 0 && ` (ל-${preexisting} מהן כבר יש הצעה)`}. קלוד יפיק לכל אחת הצעת ציון
        והערכה שנשמרת כטיוטה בעמוד ההגשה. שום דבר לא נשלח לתלמידים לפני האישור שלך. בזמן ההרצה
        צריך להשאיר את הדף פתוח.
      </p>

      <div className="mb-3 h-3 overflow-hidden rounded-full bg-[color:var(--primary)]/10">
        <div
          className="h-full rounded-full bg-[color:var(--success)] transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mb-4 text-xs font-semibold text-[color:var(--primary)]/70">
        יש הצעה ל-{done} מתוך {items.length}
        {failed > 0 && <span className="text-[color:var(--danger)]"> · {failed} נכשלו</span>}
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {running ? (
          <>
            <span className="rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-bold text-white opacity-80">
              מפיקים הצעות... ({done} מתוך {items.length})
            </span>
            <button
              onClick={stop}
              disabled={stopping}
              className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-50"
            >
              {stopping ? "עוצרים אחרי הבדיקות שכבר רצות..." : "עצירה"}
            </button>
          </>
        ) : remaining === 0 ? (
          <span className="rounded-full bg-[color:var(--success)]/15 px-5 py-2 text-sm font-bold text-[color:var(--success)]">
            ✅ לכל ההגשות יש הצעה. אפשר לעבור עליהן ולאשר.
          </span>
        ) : (
          <>
            <button
              onClick={() => run(false)}
              className="rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-bold text-white"
            >
              {done > preexisting || failed > 0
                ? `המשך הפקה (${remaining} נותרו)`
                : `הפקת הצעות ל-${remaining} הגשות`}
            </button>
            {failed > 0 && (
              <button
                onClick={() => run(true)}
                className="rounded-full border border-[color:var(--danger)]/60 px-5 py-2 text-sm font-bold text-[color:var(--danger)]"
              >
                נסי שוב את {failed} שנכשלו
              </button>
            )}
          </>
        )}
      </div>

      {failed > 0 && (
        <ul className="mt-4 space-y-2">
          {items
            .filter((i) => states[keyOf(i)] === "failed")
            .map((i) => (
              <li
                key={keyOf(i)}
                className="rounded-lg border border-[color:var(--danger)]/30 bg-[color:var(--danger)]/5 p-3 text-xs leading-6"
              >
                <Link
                  href={`/dashboard/submission/${i.taskId}/${i.userId}`}
                  className="font-bold text-[color:var(--primary)] underline"
                >
                  {i.studentName} · {i.taskTitle}
                </Link>
                <p className="text-[color:var(--danger)]">⚠️ {errors[keyOf(i)]}</p>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
