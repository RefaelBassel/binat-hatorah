"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { requestGradeProposal } from "@/lib/grade-assist-client";

type Item = { taskId: number; userId: number };

// A few checks at a time: fast enough for dozens of submissions, gentle on
// the Anthropic rate limit.
const CONCURRENCY = 3;

// Runs the Claude check on every submission that has no grade yet. Each
// result is stored as a draft proposal only — the teacher still reviews and
// approves every grade on the submission page.
export default function BatchGradeAssist({ items }: { items: Item[] }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done">("idle");
  const [queueSize, setQueueSize] = useState(0);
  const [done, setDone] = useState(0);
  const [failed, setFailed] = useState<{ item: Item; error: string }[]>([]);

  const run = async (queue: Item[]) => {
    setState("running");
    setQueueSize(queue.length);
    setDone(0);
    setFailed([]);
    let next = 0;
    const worker = async () => {
      while (next < queue.length) {
        const item = queue[next++];
        const result = await requestGradeProposal(item.taskId, item.userId);
        if (!result.ok) setFailed((f) => [...f, { item, error: result.error }]);
        setDone((d) => d + 1);
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)
    );
    setState("done");
    router.refresh();
  };

  // stays mounted after a full run so the summary remains visible
  if (items.length === 0 && state === "idle") return null;

  return (
    <div className="mb-8 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm font-bold text-[color:var(--primary)]">
          ✨ {items.length} הגשות עדיין בלי ציון
        </p>
        <button
          type="button"
          onClick={() => run(items)}
          disabled={state === "running" || items.length === 0}
          aria-busy={state === "running"}
          className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {state === "running" ? "בודק..." : "בדיקה והצעת ציון לכולן"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[color:var(--foreground)]/60">
        קלוד יבדוק כל הגשה ויכין הצעת ציון והערכה. שום דבר לא נשלח לתלמידים —
        את ההצעות רואים ומאשרים בעמוד של כל הגשה.
      </p>
      {state !== "idle" && (
        <p
          role="status"
          className={`mt-3 text-xs font-semibold ${state === "running" ? "animate-pulse text-[color:var(--primary)]/70" : "text-[color:var(--success)]"}`}
        >
          {state === "running"
            ? `⏳ נבדקו ${done} מתוך ${queueSize}...`
            : `✅ הסתיים: ${done - failed.length} הצעות ציון מוכנות`}
        </p>
      )}
      {state === "done" && failed.length > 0 && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 px-3 py-2"
        >
          <p className="text-xs font-semibold text-[color:var(--danger)]">
            ⚠️ {failed.length} בדיקות נכשלו ({failed[0].error})
          </p>
          <button
            type="button"
            onClick={() => run(failed.map((f) => f.item))}
            className="rounded-full border border-[color:var(--danger)]/60 px-3 py-1 text-xs font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
          >
            נסי שוב
          </button>
        </div>
      )}
    </div>
  );
}
