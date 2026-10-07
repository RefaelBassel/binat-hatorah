"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Runs the Claude grade proposal over every submission of the task that
// still has none — one request at a time, so each stays within the
// server's time limit and the teacher sees the progress.
export default function BulkGradeAssist({
  taskId,
  missingUserIds,
}: {
  taskId: number;
  missingUserIds: number[];
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState(0);
  const [finished, setFinished] = useState(false);

  if (missingUserIds.length === 0 && !finished) return null;

  const run = async () => {
    setRunning(true);
    setFinished(false);
    setDone(0);
    setFailed(0);
    let fails = 0;
    for (const userId of missingUserIds) {
      try {
        const res = await fetch("/api/grade-assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId, userId }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.ok) fails += 1;
      } catch {
        fails += 1;
      }
      setFailed(fails);
      setDone((d) => d + 1);
    }
    setRunning(false);
    setFinished(true);
    router.refresh();
  };

  const total = missingUserIds.length;
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <div>
        <p className="text-sm font-bold text-[color:var(--primary)]">✨ הצעות ציון של קלוד</p>
        <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
          {running
            ? `קלוד בודק הגשות... ${done} מתוך ${total}`
            : finished
              ? failed > 0
                ? `הבדיקה הסתיימה: ${done - failed} הצעות הופקו, ${failed} נכשלו — אפשר ללחוץ שוב כדי לנסות אותן מחדש.`
                : `✅ הבדיקה הסתיימה: הופקו הצעות לכל ${done} ההגשות.`
              : `ל-${total} הגשות עוד אין הצעת ציון והערכה.`}
        </p>
      </div>
      {total > 0 && (
        <button
          onClick={run}
          disabled={running}
          className="shrink-0 rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:opacity-50"
        >
          {running ? `בודקים... (${done}/${total})` : finished && failed > 0 ? "נסי שוב" : "הפקת הצעות לכל ההגשות החסרות"}
        </button>
      )}
    </div>
  );
}
