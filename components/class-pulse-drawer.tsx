"use client";

// דופק כיתה — teacher-only side drawer showing, live, how the whole class
// is doing on the task open right now: who is actively working (heartbeat
// within the last two minutes), how far each student is (every question
// weighs the same), who already submitted — and who is not present at all.
// A button opens the projectable class board in a new tab.
//
// Same physical-drawer mechanics as the reflection drawer (drag past
// halfway to open, tap to toggle), docked a little higher on the edge so
// the two handles never collide.

import { useEffect, useRef, useState } from "react";

interface StudentRow {
  id: number;
  name: string;
  stage: number;
  unitsDone: number;
  doneKeys: string[];
  workSeconds: number;
  lastBeat: number | null;
  status: "active" | "idle" | "submitted" | "absent";
}

interface ClassStatus {
  task: { id: number; title: string; subtitle: string; bookRef: string; dueAt: number };
  totalUnits: number;
  units: { key: string; label: string; part: "a" | "b" }[];
  students: StudentRow[];
}

const HANDLE_W = 30;

export default function ClassPulseDrawer({ taskId }: { taskId: number }) {
  const [open, setOpen] = useState(false);
  const [panelW, setPanelW] = useState(360);
  const [dragX, setDragX] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; base: number; moved: boolean; last: number } | null>(null);
  const [data, setData] = useState<ClassStatus | null>(null);

  useEffect(() => {
    const compute = () => setPanelW(Math.min(360, Math.round(window.innerWidth * 0.88)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // poll while open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () =>
      fetch(`/api/tasks/${taskId}/class-status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setData(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [open, taskId]);

  const closedX = -panelW;
  const currentX = dragX ?? (open ? 0 : closedX);
  const dragging = dragX !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    dragStart.current = { x: e.clientX, base: open ? 0 : closedX, moved: false, last: open ? 0 : closedX };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    if (Math.abs(dx) > 4) dragStart.current.moved = true;
    const next = Math.max(closedX, Math.min(0, dragStart.current.base + dx));
    dragStart.current.last = next;
    setDragX(next);
  };
  const onPointerUp = () => {
    if (!dragStart.current) return;
    const { moved, last } = dragStart.current;
    dragStart.current = null;
    setDragX(null);
    if (!moved) {
      setOpen((o) => !o);
      return;
    }
    setOpen(last > closedX / 2);
  };

  const groups = data
    ? {
        active: data.students.filter((s) => s.status === "active"),
        submitted: data.students.filter((s) => s.status === "submitted"),
        away: data.students.filter((s) => s.status === "idle" || s.status === "absent"),
      }
    : null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)} aria-hidden />
      )}
      <div
        className="fixed z-50"
        style={{
          insetInlineEnd: 0,
          top: "24%",
          transform: `translateX(${currentX}px)`,
          transition: dragging ? "none" : "transform 380ms cubic-bezier(0.25, 1.1, 0.35, 1.05)",
          display: "flex",
          alignItems: "flex-start",
          insetInlineStart: "auto",
        }}
        dir="rtl"
      >
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={open ? "סגירת דופק הכיתה" : "פתיחת דופק הכיתה"}
          aria-expanded={open}
          className="mt-6 flex select-none flex-col items-center justify-center gap-0.5 rounded-s-xl shadow-md"
          style={{
            width: HANDLE_W,
            height: 68,
            background: "var(--accent)",
            color: "#fff",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            border: "none",
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>📊</span>
          <span aria-hidden style={{ width: 3, height: 22, borderRadius: 2, background: "rgba(255,255,255,0.45)" }} />
        </button>

        <aside
          aria-hidden={!open && !dragging}
          className="overflow-y-auto rounded-s-2xl border-s border-y border-[color:var(--border)] shadow-2xl"
          style={{
            width: panelW,
            maxHeight: "72vh",
            background: "var(--card)",
            boxShadow: "inset -12px 0 18px -14px rgba(46,36,56,0.35), 0 18px 45px -18px rgba(46,36,56,0.45)",
          }}
        >
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-[color:var(--primary)]">
                📊 דופק כיתה
              </p>
              <a
                href={`/dashboard/class-board/${taskId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[color:var(--primary)] px-3 py-1 text-[11px] font-bold text-white shadow transition hover:scale-[1.03]"
              >
                🖥️ הקרנה על הלוח
              </a>
            </div>
            {data && (
              <p className="mt-1 text-[10px] text-[color:var(--primary)]/55">
                {data.task.bookRef} · {data.task.title}
              </p>
            )}
          </div>

          {!data || !groups ? (
            <p className="p-5 text-xs text-[color:var(--foreground)]/60">טוען את מצב הכיתה...</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="rounded-full bg-[color:var(--success)]/10 px-2.5 py-1 text-[color:var(--success)]">
                  🟢 עובדים עכשיו: {groups.active.length}
                </span>
                <span className="rounded-full bg-[color:var(--primary)]/10 px-2.5 py-1 text-[color:var(--primary)]">
                  ✅ הגישו: {groups.submitted.length}
                </span>
                <span className="rounded-full bg-[color:var(--danger)]/10 px-2.5 py-1 text-[color:var(--danger)]">
                  ⚪ לא נוכחים: {groups.away.length}
                </span>
              </div>

              {groups.active.length > 0 && (
                <StudentGroup title="עובדים עכשיו" students={groups.active} data={data} live />
              )}
              {groups.submitted.length > 0 && (
                <StudentGroup title="הגישו 🎉" students={groups.submitted} data={data} />
              )}
              {groups.away.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[color:var(--danger)]/80">
                    לא נוכחים כרגע
                  </p>
                  <ul className="space-y-1">
                    {groups.away.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-xs opacity-70"
                      >
                        <span>{s.name}</span>
                        <span className="text-[10px] text-[color:var(--primary)]/50">
                          {s.stage === 0
                            ? "טרם נפתחה"
                            : `${s.unitsDone}/${data.totalUnits} · לא פעיל/ה`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function StudentGroup({
  title,
  students,
  data,
  live,
}: {
  title: string;
  students: StudentRow[];
  data: ClassStatus;
  live?: boolean;
}) {
  const sorted = [...students].sort((a, b) => b.unitsDone - a.unitsDone);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold text-[color:var(--primary)]/70">{title}</p>
      <ul className="space-y-1.5">
        {sorted.map((s) => {
          const pct = Math.round((100 * s.unitsDone) / Math.max(1, data.totalUnits));
          return (
            <li key={s.id} className="rounded-xl bg-[color:var(--background)] px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[color:var(--foreground)]">
                  {live && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--success)]" />
                    </span>
                  )}
                  {s.name}
                </span>
                <span className="text-[10px] font-bold text-[color:var(--primary)]/60">
                  {s.unitsDone}/{data.totalUnits} · {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? "var(--success)" : "var(--primary)",
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[color:var(--primary)]/50">
                <span>
                  {s.stage >= 8 ? "חלק ב — העמקה ודיון" : `חלק א · שלב ${s.stage || 1} מתוך 7`}
                </span>
                <span>⏱ {Math.round(s.workSeconds / 60)} דק׳</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
