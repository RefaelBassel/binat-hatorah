"use client";

import { useState } from "react";

// The reflection side drawer — available on every page via a floating side
// tab, because a lesson doesn't always end exactly when a task ends.
// Interactive: three draggable sliders between poles + free text. The
// current context (task, Tanach chapter, date+time) is captured
// automatically and stored with the reflection.
export default function ReflectionDrawer({
  taskId,
  contextRef,
}: {
  taskId?: number;
  contextRef: string;
}) {
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState(5);
  const [pshat, setPshat] = useState(5);
  const [argument, setArgument] = useState(5);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

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
      {/* floating side tab */}
      <button
        onClick={() => setOpen(true)}
        aria-label="פתיחת רפלקציה"
        className="fixed bottom-24 end-0 z-40 rounded-s-2xl bg-[color:var(--primary)] px-2.5 py-4 text-white shadow-lg transition hover:px-4"
        style={{ writingMode: "vertical-rl" }}
      >
        <span className="text-xs font-bold tracking-wider">🪞 רפלקציה</span>
      </button>

      {/* backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* drawer */}
      <aside
        className="fixed inset-y-0 end-0 z-50 flex w-[26rem] max-w-[92vw] flex-col overflow-y-auto bg-[color:var(--card)] shadow-2xl transition-transform duration-300 ease-out"
        style={{ transform: open ? "translateX(0)" : "translateX(-110%)" }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
          <div>
            <p className="font-display text-lg font-bold text-[color:var(--primary)]">
              🪞 רגע של רפלקציה
            </p>
            <p className="text-[11px] text-[color:var(--primary)]/55">
              {nowLabel} · {contextRef}
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="סגירה"
            className="rounded-lg p-1.5 text-[color:var(--primary)]/60 hover:bg-[color:var(--primary)]/5"
          >
            ✕
          </button>
        </div>

        {state === "done" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="text-5xl">🌱</span>
            <p className="font-display text-lg font-bold text-[color:var(--success)]">
              הרפלקציה נשמרה!
            </p>
            <p className="text-xs text-[color:var(--foreground)]/60">
              אפשר לראות את כל הרפלקציות והגרף שלך בעמוד האישי.
            </p>
          </div>
        ) : (
          <div className="flex-1 space-y-6 p-5">
            <PoleSlider
              label="כמה קשה היה לי היום?"
              right="קל לי מאוד 😌"
              left="קשה לי מאוד 🥵"
              value={difficulty}
              onChange={setDifficulty}
            />
            <PoleSlider
              label="כמה התקדמתי בפענוח הפשט? 📖"
              right="דרכתי במקום"
              left="צעד ענק קדימה 🚀"
              value={pshat}
              onChange={setPshat}
            />
            <PoleSlider
              label="כמה התקדמתי במיומנות הטיעון? ⚖️"
              right="דרכתי במקום"
              left="צעד ענק קדימה 🚀"
              value={argument}
              onChange={setArgument}
            />
            <label className="block">
              <span className="mb-1 block text-sm font-bold text-[color:var(--primary)]">
                במילים שלי 💬
              </span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                placeholder="מה היה לי משמעותי? מה הפתיע? מה עדיין מבלבל?"
                className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
              />
            </label>
            <button
              onClick={submit}
              disabled={state === "busy"}
              className="w-full rounded-full bg-[color:var(--primary)] py-3 text-sm font-bold text-white shadow transition hover:scale-[1.01] disabled:opacity-50"
            >
              {state === "busy" ? "שומרת..." : "שמירת הרפלקציה 🌱"}
            </button>
          </div>
        )}
      </aside>
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
      <p className="mb-1.5 text-sm font-bold text-[color:var(--primary)]">{label}</p>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#b96a3b]"
      />
      <div className="flex justify-between text-[11px] text-[color:var(--primary)]/55">
        <span>{right}</span>
        <span className="font-display text-sm font-bold text-[color:var(--accent)]">{value}</span>
        <span>{left}</span>
      </div>
    </div>
  );
}
