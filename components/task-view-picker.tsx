"use client";

import { useRef, useState } from "react";
import { ViewSwitch, type SaveStatus } from "@/components/task/worksheet-slides";
import type { TaskView } from "@/lib/task-view";

// The worksheet-layout preference on /me (same setting as the switch at the
// top of a task's worksheet; saved on the account).
export default function TaskViewPicker({ initial }: { initial: TaskView | null }) {
  const [view, setView] = useState<TaskView | null>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const seq = useRef(0);

  const change = async (next: TaskView) => {
    if (next === view) return;
    const prev = view;
    setView(next);
    const mine = ++seq.current;
    setStatus("saving");
    const res = await fetch("/api/profile/task-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: next }),
    }).catch(() => null);
    if (mine !== seq.current) return;
    if (!res?.ok) setView(prev);
    setStatus(res?.ok ? "saved" : "error");
    if (res?.ok) setTimeout(() => mine === seq.current && setStatus("idle"), 2000);
  };

  return (
    <div>
      <p className="mb-2 text-sm font-bold text-[color:var(--primary)]">תצוגת דף העבודה</p>
      <ViewSwitch view={view} onChange={change} status={status} />
      <p className="mt-1 text-[11px] text-[color:var(--primary)]/55">
        חל על כל המשימות. אפשר להחליף גם בראש דף העבודה.
      </p>
    </div>
  );
}
