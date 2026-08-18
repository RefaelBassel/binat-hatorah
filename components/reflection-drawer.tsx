"use client";

import { useEffect, useRef, useState } from "react";

// The reflection drawer — styled and behaving like a REAL drawer:
// a small handle sticks out of the side of the screen at mid-height;
// the panel slides out from exactly where the handle is (the handle stays
// attached to the drawer front, like pulling a physical drawer);
// the handle supports actual DRAG (pointer) — pull past halfway and it
// opens, let go early and it snaps back — plus a simple tap/click toggle.
// Context (task, chapter, date+time) is captured automatically.

const HANDLE_W = 30; // px

export default function ReflectionDrawer({
  taskId,
  contextRef,
}: {
  taskId?: number;
  contextRef: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelW, setPanelW] = useState(340);
  const [dragX, setDragX] = useState<number | null>(null);
  const dragStart = useRef<{
    x: number;
    base: number;
    moved: boolean;
    last: number;
  } | null>(null);

  const [difficulty, setDifficulty] = useState(5);
  const [pshat, setPshat] = useState(5);
  const [argument, setArgument] = useState(5);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    const compute = () =>
      setPanelW(Math.min(340, Math.round(window.innerWidth * 0.84)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Horizontal translate of the drawer assembly. The drawer lives on the
  // inline-end side (left in RTL): closed = panel pushed off-screen left,
  // only the handle peeks out; open = flush with the edge.
  const closedX = -panelW;
  const currentX = dragX ?? (open ? 0 : closedX);
  const dragging = dragX !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // some browsers/synthetic events can't capture — dragging still works
    }
    const base = open ? 0 : closedX;
    dragStart.current = { x: e.clientX, base, moved: false, last: base };
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
      // simple tap — toggle
      setOpen((o) => !o);
      return;
    }
    setOpen(last > closedX / 2); // pulled past halfway → open, else snap back
  };

  const submit = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          contextRef,
          difficulty,
          pshatProgress: pshat,
          argumentProgress: argument,
          note,
        }),
      });
      if ((await res.json()).ok) {
        setState("done");
        setTimeout(() => {
          setOpen(false);
          setState("idle");
          setNote("");
        }, 2200);
      } else setState("idle");
    } catch {
      setState("idle");
    }
  };

  const nowLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <>
      {/* backdrop — only when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* the drawer assembly: panel + attached handle, sliding together */}
      <div
        className="fixed z-50"
        style={{
          insetInlineEnd: 0,
          top: "50%",
          transform: `translateY(-50%) translateX(${currentX}px)`,
          transition: dragging
            ? "none"
            : "transform 380ms cubic-bezier(0.25, 1.1, 0.35, 1.05)",
          display: "flex",
          alignItems: "center",
          insetInlineStart: "auto",
          // transparent wrapper overlaps the class-pulse drawer's handle —
          // only the handle and panel may catch pointer events
          pointerEvents: "none",
        }}
        dir="rtl"
      >
        {/* handle — small, attached to the drawer front */}
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={open ? "סגירת הרפלקציה" : "פתיחת הרפלקציה"}
          aria-expanded={open}
          className="flex select-none flex-col items-center justify-center gap-0.5 rounded-s-xl shadow-md"
          style={{
            width: HANDLE_W,
            height: 68,
            background: "var(--primary)",
            color: "#fff",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            border: "none",
            pointerEvents: "auto",
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>
            🪞
          </span>
          {/* drawer-handle groove lines */}
          <span
            aria-hidden
            style={{
              width: 3,
              height: 22,
              borderRadius: 2,
              background: "rgba(255,255,255,0.45)",
            }}
          />
        </button>

        {/* the drawer panel */}
        <aside
          aria-hidden={!open && !dragging}
          className="overflow-y-auto rounded-s-2xl border-s border-y border-[color:var(--border)] shadow-2xl"
          style={{
            width: panelW,
            maxHeight: "76vh",
            background: "var(--card)",
            // subtle "inside of a drawer" depth on the leading edge
            boxShadow:
              "inset -12px 0 18px -14px rgba(46,36,56,0.35), 0 18px 45px -18px rgba(46,36,56,0.45)",
            pointerEvents: "auto",
          }}
        >
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <p className="font-display text-base font-bold text-[color:var(--primary)]">
              🪞 רגע של רפלקציה
            </p>
            <p className="text-[10px] text-[color:var(--primary)]/55">
              {nowLabel} · {contextRef}
            </p>
          </div>

          {state === "done" ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="text-4xl">🌱</span>
              <p className="font-display text-base font-bold text-[color:var(--success)]">
                הרפלקציה נשמרה!
              </p>
              <p className="text-[11px] text-[color:var(--foreground)]/60">
                כל הרפלקציות והגרף שלך — בעמוד האישי.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <PoleSlider
                label="כמה קשה היה לי היום?"
                right="קל מאוד 😌"
                left="קשה מאוד 🥵"
                value={difficulty}
                onChange={setDifficulty}
              />
              <PoleSlider
                label="התקדמות בפענוח הפשט 📖"
                right="דרכתי במקום"
                left="צעד ענק 🚀"
                value={pshat}
                onChange={setPshat}
              />
              <PoleSlider
                label="התקדמות במיומנות הטיעון ⚖️"
                right="דרכתי במקום"
                left="צעד ענק 🚀"
                value={argument}
                onChange={setArgument}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[color:var(--primary)]">
                  במילים שלי 💬
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="מה היה משמעותי? מה הפתיע? מה עוד מבלבל?"
                  className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-[color:var(--accent)]"
                />
              </label>
              <button
                onClick={submit}
                disabled={state === "busy"}
                className="w-full rounded-full bg-[color:var(--primary)] py-2.5 text-xs font-bold text-white shadow transition hover:scale-[1.01] disabled:opacity-50"
              >
                {state === "busy" ? "שומרים..." : "שמירת הרפלקציה 🌱"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function PoleSlider({
  label,
  right,
  left,
  value,
  onChange,
}: {
  label: string;
  right: string;
  left: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-[color:var(--primary)]">{label}</p>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#b96a3b]"
      />
      <div className="flex justify-between text-[10px] text-[color:var(--primary)]/55">
        <span>{right}</span>
        <span className="font-display text-xs font-bold text-[color:var(--accent)]">
          {value}
        </span>
        <span>{left}</span>
      </div>
    </div>
  );
}
