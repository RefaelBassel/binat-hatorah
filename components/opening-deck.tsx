"use client";

import { PlenaryEditor } from "./task/thinking-card";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { OpeningDeck, PlenaryQuestion } from "@/content/tasks/types";
import SaveButton from "./save-button";

// אור פותח — the teacher's opening deck for a lesson. Four slides, in the
// language of the מוסר / סיור בגן החיות decks: title → שאלה לפתיחה → לחשוב
// על… → the plenary question left hanging ("נחזור לזה בסוף"). The deck
// TEASES and structures the classroom opening; nothing here is answered.
// RTL-forward navigation (ArrowLeft / Space / Enter / click = next), Esc
// exits, ⛶ fullscreen. Teachers edit the opener and hook in place (✏️).

const GRAPE = "#413055";
const COPPER = "#b96a3b";

// entrance helpers — spread onto an element; `extra` carries its own classes
function fade(delay: number, extra = ""): { className: string; style: CSSProperties } {
  return { className: `deck-fade ${extra}`.trim(), style: { animationDelay: `${delay}s` } };
}
function pop(delay: number, extra = ""): { className: string; style: CSSProperties } {
  return { className: `deck-pop ${extra}`.trim(), style: { animationDelay: `${delay}s` } };
}

function Motif({ color = COPPER, delay = 0 }: { color?: string; delay?: number }) {
  return (
    <div aria-hidden {...fade(delay, "flex items-center justify-center gap-3")}>
      <span className="h-px w-14" style={{ background: `${color}99` }} />
      <span className="h-2.5 w-2.5 rotate-45" style={{ background: color }} />
      <span className="h-px w-14" style={{ background: `${color}99` }} />
    </div>
  );
}

function DarkSlide({ children }: { children: ReactNode }) {
  return (
    <section
      className="deck-pan relative flex min-h-full flex-col items-center justify-center overflow-hidden px-8 py-16 text-center text-white"
      style={{
        backgroundImage: `radial-gradient(1200px 600px at 70% -10%, #6a5585 0%, ${GRAPE} 45%, #2a1f3a 100%)`,
      }}
    >
      <span aria-hidden className="deck-float absolute start-[10%] top-[12%] h-3 w-3 rotate-45" style={{ background: `${COPPER}b3` }} />
      <span aria-hidden className="deck-float absolute bottom-[18%] end-[12%] h-2 w-2 rotate-45" style={{ background: `${COPPER}80`, animationDelay: "1.4s" }} />
      <span aria-hidden className="deck-float absolute end-[18%] top-[24%] h-24 w-24 rounded-full border border-white/10" style={{ animationDelay: "0.7s" }} />
      <span aria-hidden className="deck-float absolute bottom-[10%] start-[16%] h-36 w-36 rounded-full border border-white/5" style={{ animationDelay: "2s" }} />
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-6">{children}</div>
    </section>
  );
}

function LightSlide({ children, watermark }: { children: ReactNode; watermark?: string }) {
  return (
    <section
      className="relative flex min-h-full flex-col items-center justify-center overflow-hidden px-8 py-14 text-center"
      style={{
        background: `radial-gradient(900px 480px at 85% 0%, ${GRAPE}1f 0%, transparent 60%), radial-gradient(700px 420px at 0% 100%, ${COPPER}14 0%, transparent 55%), #fbf6f1`,
        color: "#2e2438",
      }}
    >
      {watermark && (
        <span
          aria-hidden
          className="deck-float pointer-events-none absolute -start-6 top-1/2 -translate-y-1/2 select-none font-display font-extrabold leading-none"
          style={{ color: `${GRAPE}0d`, fontSize: "34rem" }}
        >
          {watermark}
        </span>
      )}
      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-6">{children}</div>
    </section>
  );
}

function Chip({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <span
      className="deck-pop mx-auto inline-block rounded-full px-5 py-2 text-base font-bold tracking-wide shadow-sm"
      style={{ ...pop(delay).style, rotate: "-2deg", background: `${COPPER}33`, color: "#7a4322" }}
    >
      {children}
    </span>
  );
}

export function buildOpeningSlides({
  title,
  subtitle,
  bookRef,
  opening,
  plenary,
}: {
  title: string;
  subtitle?: string;
  bookRef: string;
  opening: OpeningDeck | null;
  plenary: PlenaryQuestion | null;
}): ReactNode[] {
  const slides: ReactNode[] = [
    <DarkSlide key="title">
      <p {...fade(0, "text-sm font-semibold tracking-[0.35em] text-white/60")}>
        אור פותח
      </p>
      <Motif delay={0.15} />
      <h1 {...fade(0.3, "font-display text-5xl font-extrabold leading-tight sm:text-6xl")}>
        {title}
      </h1>
      {subtitle && (
        <p {...fade(0.5, "text-2xl text-white/80")}>
          {subtitle}
        </p>
      )}
      <p className="deck-fade text-lg" style={{ animationDelay: "0.7s", color: "#e0a47a" }}>
        📖 {bookRef}
      </p>
    </DarkSlide>,
  ];
  if (opening?.opener) {
    slides.push(
      <LightSlide key="opener" watermark="?">
        <Chip delay={0.1}>
          <span className="deck-bounce">💭</span> שאלה לפתיחה
        </Chip>
        <p
          className="deck-fade max-w-4xl font-display text-4xl font-extrabold leading-snug sm:text-5xl"
          style={{ color: GRAPE, animationDelay: "0.4s" }}
        >
          {opening.opener}
        </p>
        <Motif delay={0.8} />
      </LightSlide>
    );
  }
  if (opening?.hook) {
    slides.push(
      <LightSlide key="hook">
        <p className="deck-fade text-sm font-semibold tracking-[0.35em]" style={{ color: COPPER }}>
          לחשוב על…
        </p>
        <p {...fade(0.3, "max-w-4xl text-3xl leading-relaxed sm:text-4xl")}>
          {opening.hook}
        </p>
      </LightSlide>
    );
  }
  if (plenary?.question) {
    slides.push(
      <DarkSlide key="plenary">
        <Chip delay={0.1}>
          <span className="deck-bounce">🧭</span> נחזור לזה בסוף השיעור
        </Chip>
        <p {...fade(0.4, "max-w-4xl font-display text-4xl font-extrabold leading-snug sm:text-5xl")}>
          {plenary.question}
        </p>
        <p {...fade(0.9, "text-lg text-white/60")}>
          עכשיו — אל הפסוקים.
        </p>
      </DarkSlide>
    );
  }
  return slides;
}

export default function OpeningDeckPlayer({
  taskId,
  contentRef,
  title,
  subtitle,
  bookRef,
  opening,
  plenary,
}: {
  taskId: number;
  contentRef: string;
  title: string;
  subtitle?: string;
  bookRef: string;
  opening: OpeningDeck | null;
  plenary: PlenaryQuestion | null;
}) {
  const slides = buildOpeningSlides({ title, subtitle, bookRef, opening, plenary });
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const touchStart = useRef<number | null>(null);
  const count = slides.length;
  const backHref = `/dashboard/task/${taskId}`;

  const go = useCallback(
    (next: number) => setIdx(Math.max(0, Math.min(count - 1, next))),
    [count]
  );

  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === " " || e.key === "Enter" || e.key === "PageDown") {
        e.preventDefault();
        setIdx((i) => Math.min(count - 1, i + 1));
      } else if (e.key === "ArrowRight" || e.key === "PageUp") {
        e.preventDefault();
        setIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Home") setIdx(0);
      else if (e.key === "End") setIdx(count - 1);
      else if (e.key === "Escape") {
        if (document.fullscreenElement) void document.exitFullscreen();
        else window.location.href = backHref;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, editing, backHref]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  return (
    <div ref={rootRef} dir="rtl" className="fixed inset-0 z-[70] flex flex-col overflow-hidden" style={{ background: "#fbf6f1" }}>
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur" style={{ borderColor: "#e9ddd2", background: "rgba(255,253,250,0.85)" }}>
        <div className="flex items-center gap-3">
          <a href={backHref} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "#e9ddd2", color: GRAPE }}>
            → יציאה מהמצגת
          </a>
          <span className="hidden text-sm font-semibold sm:inline" style={{ color: GRAPE }}>
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="rounded-full border border-dashed px-3 py-1 text-xs font-bold"
            style={{ borderColor: `${GRAPE}66`, color: GRAPE }}
          >
            ✏️ {editing ? "סגירת העריכה" : "עריכת המצגת"}
          </button>
          <span className="text-xs tabular-nums" style={{ color: `${GRAPE}99` }}>
            {idx + 1} / {count}
          </span>
          <button type="button" onClick={toggleFullscreen} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "#e9ddd2", color: GRAPE }}>
            ⛶ מסך מלא
          </button>
        </div>
      </div>

      {editing ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mx-auto max-w-2xl space-y-5">
            <DeckTitleEditor contentRef={contentRef} title={title} subtitle={subtitle ?? ""} bookRef={bookRef} />
            <OpeningEditor contentRef={contentRef} initial={opening} onClose={() => setEditing(false)} />
            <div className="rounded-2xl border-2 bg-white p-6" style={{ borderColor: `${GRAPE}4d` }}>
              <p className="font-display text-lg font-extrabold" style={{ color: GRAPE }}>
                💭 השקף האחרון — שאלת המליאה
              </p>
              <p className="mb-2 text-xs" style={{ color: `${GRAPE}99` }}>
                אותה שאלה מופיעה לתלמידות ככרטיס ״שאלה למחשבה״ אחרי חלק ב, ובמסך הסגירה שלך.
              </p>
              <PlenaryEditor contentRef={contentRef} initial={plenary} />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1 cursor-pointer select-none overflow-hidden"
          onClick={() => go(idx + 1)}
          onPointerDown={(e) => {
            touchStart.current = e.clientX;
          }}
          onPointerUp={(e) => {
            const start = touchStart.current;
            touchStart.current = null;
            if (start == null) return;
            const dx = e.clientX - start;
            if (Math.abs(dx) > 60) go(dx > 0 ? idx + 1 : idx - 1);
          }}
        >
          <div key={idx} className="absolute inset-0 overflow-y-auto">
            {slides[idx]}
          </div>
          {idx > 0 && (
            <button
              type="button"
              aria-label="השקף הקודם"
              onClick={(e) => {
                e.stopPropagation();
                go(idx - 1);
              }}
              className="absolute start-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/90 px-3 py-2 text-lg shadow-sm transition hover:scale-110"
              style={{ borderColor: "#e9ddd2", color: GRAPE }}
            >
              ›
            </button>
          )}
          {idx < count - 1 && (
            <button
              type="button"
              aria-label="השקף הבא"
              onClick={(e) => {
                e.stopPropagation();
                go(idx + 1);
              }}
              className="absolute end-3 top-1/2 -translate-y-1/2 rounded-full border bg-white/90 px-3 py-2 text-lg shadow-sm transition hover:scale-110"
              style={{ borderColor: "#e9ddd2", color: GRAPE }}
            >
              ‹
            </button>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-1.5 border-t px-4 py-2.5" style={{ borderColor: "#e9ddd2", background: "rgba(255,253,250,0.85)" }}>
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`מעבר לשקף ${i + 1}`}
            onClick={() => go(i)}
            className="rounded-full transition-all"
            style={{ width: i === idx ? 22 : 8, height: 8, background: i === idx ? GRAPE : i < idx ? COPPER : "#e9ddd2" }}
          />
        ))}
      </div>
    </div>
  );
}

// The title slide: the task's title line. Saved into the unit's edits
// (merged — the rest of the unit's edits stay untouched).
export function DeckTitleEditor({ contentRef, title, subtitle, bookRef }: { contentRef: string; title: string; subtitle: string; bookRef: string }) {
  const router = useRouter();
  const [v, setV] = useState({ title, subtitle, bookRef });
  const [saved, setSaved] = useState(JSON.stringify({ title, subtitle, bookRef }));
  const dirty = JSON.stringify(v) !== saved && v.title.trim().length > 0;
  const save = async () => {
    const res = await fetch("/api/content-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentRef, field: "unit", merge: true, value: { title: v.title, subtitle: v.subtitle, bookRef: v.bookRef } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "השמירה נכשלה");
    setSaved(JSON.stringify(v));
    router.refresh();
  };
  const field = (label: string, key: "title" | "subtitle" | "bookRef") => (
    <>
      <label className="block text-[11px] font-semibold" style={{ color: `${GRAPE}99` }}>
        {label}
      </label>
      <input
        value={v[key]}
        onChange={(e) => setV((o) => ({ ...o, [key]: e.target.value }))}
        className="mb-3 mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
        style={{ borderColor: "#e9ddd2" }}
      />
    </>
  );
  return (
    <div className="rounded-2xl border-2 bg-white p-6" style={{ borderColor: `${GRAPE}4d` }}>
      <p className="font-display text-lg font-extrabold" style={{ color: GRAPE }}>
        🏷️ השקף הראשון — כותרת ופרק
      </p>
      <p className="mb-3 text-xs" style={{ color: `${GRAPE}99` }}>
        זו גם כותרת המשימה שהתלמידות רואות.
      </p>
      {field("כותרת", "title")}
      {field("תת-כותרת (לא חובה)", "subtitle")}
      {field("ספר, פרק ופסוקים", "bookRef")}
      <SaveButton dirty={dirty} onSave={save} />
    </div>
  );
}

// In-place editor for the opener / hook (the plenary slide is edited where
// the plenary question lives — the thinking card or the closing screen).
export function OpeningEditor({
  contentRef,
  initial,
  onClose,
}: {
  contentRef: string;
  initial: OpeningDeck | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [opener, setOpener] = useState(initial?.opener ?? "");
  const [hook, setHook] = useState(initial?.hook ?? "");
  const [saved, setSaved] = useState(JSON.stringify({ o: initial?.opener ?? "", h: initial?.hook ?? "" }));
  const dirty = JSON.stringify({ o: opener.trim(), h: hook.trim() }) !== saved && opener.trim().length > 0;

  const save = async () => {
    const res = await fetch("/api/content-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentRef, field: "opening", value: { opener, hook } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "השמירה נכשלה");
    setOpener(data.value.opener);
    setHook(data.value.hook ?? "");
    setSaved(JSON.stringify({ o: data.value.opener, h: data.value.hook ?? "" }));
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border-2 bg-white p-6" style={{ borderColor: `${GRAPE}4d` }}>
      <p className="font-display text-lg font-extrabold" style={{ color: GRAPE }}>
        ✏️ עריכת אור פותח
      </p>
      <p className="mb-4 text-xs" style={{ color: `${GRAPE}99` }}>
        שני השקפים שבאמצע: השאלה לפתיחה, ו״לחשוב על…״.
      </p>
      <label className="block text-[11px] font-semibold" style={{ color: `${GRAPE}99` }}>
        שאלה לפתיחה
      </label>
      <textarea
        value={opener}
        onChange={(e) => setOpener(e.target.value)}
        rows={3}
        className="mb-4 mt-1 w-full rounded-lg border px-3 py-2 text-sm leading-7 outline-none"
        style={{ borderColor: "#e9ddd2" }}
      />
      <label className="block text-[11px] font-semibold" style={{ color: `${GRAPE}99` }}>
        לחשוב על… (לא חובה — בלי טקסט השקף לא יוצג)
      </label>
      <textarea
        value={hook}
        onChange={(e) => setHook(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg border px-3 py-2 text-sm leading-7 outline-none"
        style={{ borderColor: "#e9ddd2" }}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <SaveButton dirty={dirty} onSave={save} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("לחזור לנוסח המקורי של אור פותח?")) return;
              await fetch("/api/content-overrides", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentRef, field: "opening", reset: true }),
              });
              router.refresh();
              onClose?.();
            }}
            className="text-xs font-semibold"
            style={{ color: `${GRAPE}80` }}
          >
            ↺ לנוסח המקורי
          </button>
          {onClose && (
            <button type="button" onClick={onClose} className="rounded-full border px-3 py-1 text-xs font-semibold" style={{ borderColor: "#e9ddd2", color: GRAPE }}>
              חזרה למצגת
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
