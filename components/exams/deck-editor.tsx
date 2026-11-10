"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  bulletsToText,
  MAX_SLIDES,
  newSlideId,
  textToBullets,
  type DeckSlide,
} from "@/lib/deck-types";

type SaveState = "saved" | "dirty" | "saving" | "error";

// Teacher-only deck screen (issue #48): edit slides (autosave), reorder by
// dragging, present full screen, print one slide per page.
export default function DeckEditor({
  deckId,
  initialTitle,
  initialSlides,
  studentCopy,
}: {
  deckId: number;
  initialTitle: string;
  initialSlides: DeckSlide[];
  // the student copy of an exam's deck (issue #53): saves elsewhere, can be
  // re-synced from the teacher's own deck and published to students
  studentCopy?: { examId: number; published: boolean };
}) {
  const saveUrl = studentCopy ? `/api/student-decks/${studentCopy.examId}` : `/api/decks/${deckId}`;
  const [published, setPublished] = useState(studentCopy?.published ?? true);
  const [pubBusy, setPubBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [note, setNote] = useState("");
  const [title, setTitle] = useState(initialTitle);
  const [slides, setSlides] = useState<DeckSlide[]>(initialSlides);
  const [openId, setOpenId] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>("saved");
  const [errMsg, setErrMsg] = useState("");
  const [presentAt, setPresentAt] = useState<number | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const latest = useRef({ title, slides });
  latest.current = { title, slides };
  const dirty = useRef(false);
  const inFlight = useRef(false);

  const save = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    dirty.current = false;
    setState("saving");
    try {
      const res = await fetch(saveUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(latest.current),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "לא נשמר.");
      setState(dirty.current ? "dirty" : "saved");
    } catch (e) {
      dirty.current = true;
      setErrMsg(e instanceof Error ? e.message : "לא נשמר.");
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [saveUrl]);

  // debounced autosave
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => void save(), 1200);
    return () => clearTimeout(t);
  }, [title, slides, save]);

  function change(next: DeckSlide[] | null, nextTitle?: string) {
    if (next) setSlides(next);
    if (nextTitle !== undefined) setTitle(nextTitle);
    dirty.current = true;
    setState("dirty");
  }

  function patch(id: string, p: Partial<DeckSlide>) {
    change(slides.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }

  function addSlide() {
    if (slides.length >= MAX_SLIDES) return;
    const s: DeckSlide = { id: newSlideId(), title: "", bullets: [], notes: "" };
    change([...slides, s]);
    setOpenId(s.id);
  }

  function removeSlide(id: string) {
    if (!window.confirm("למחוק את השקופית?")) return;
    change(slides.filter((s) => s.id !== id));
    if (openId === id) setOpenId(null);
  }

  function drop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const from = slides.findIndex((s) => s.id === dragId);
    const to = slides.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = slides.slice();
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    change(next);
  }

  function move(id: string, delta: number) {
    const i = slides.findIndex((s) => s.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= slides.length) return;
    const next = slides.slice();
    [next[i], next[j]] = [next[j], next[i]];
    change(next);
  }

  async function togglePublished() {
    if (!studentCopy) return;
    const next = !published;
    setPubBusy(true);
    setNote("");
    try {
      const res = await fetch(saveUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "לא נשמר.");
      setPublished(next);
      setNote(next ? "המצגת מפורסמת לתלמידים ✓" : "המצגת הוסתרה מהתלמידים ✓");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "לא נשמר.");
    } finally {
      setPubBusy(false);
    }
  }

  async function syncFromSource() {
    if (!studentCopy) return;
    if (!window.confirm("לעדכן את המצגת לתלמידים מהמצגת שלך? כל העריכות שעשית בעותק לתלמידים יוחלפו בשקופיות של המצגת שלך.")) return;
    setSyncBusy(true);
    setNote("");
    try {
      const res = await fetch(saveUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "העדכון לא הצליח.");
      setSlides(data.slides as DeckSlide[]);
      setOpenId(null);
      dirty.current = false;
      setState("saved");
      setNote("השקופיות הועתקו מחדש מהמצגת שלך ✓");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "העדכון לא הצליח.");
    } finally {
      setSyncBusy(false);
    }
  }

  async function deleteDeck() {
    if (!window.confirm("למחוק את כל המצגת? אי אפשר לשחזר.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/decks/${deckId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      window.location.href = "/dashboard/exams";
    } catch {
      setDeleting(false);
      setErrMsg("המחיקה לא הצליחה. נסו שוב.");
      setState("error");
    }
  }

  const statusText =
    state === "saving" ? "שומר…" : state === "dirty" ? "יש שינויים שלא נשמרו…" : state === "error" ? errMsg || "לא נשמר" : "נשמר ✓";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center gap-3">
        <input
          value={title}
          onChange={(e) => change(null, e.target.value)}
          placeholder="שם המצגת"
          aria-label="שם המצגת"
          className="min-w-0 flex-1 rounded-xl border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2 font-display text-lg font-bold"
        />
        <span
          aria-live="polite"
          className={`text-sm font-semibold ${state === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--foreground)]/70"}`}
        >
          {statusText}
        </span>
        {state === "error" && (
          <button type="button" onClick={() => void save()} className="rounded-full border-2 border-[color:var(--danger)] px-3 py-1 text-xs font-bold text-[color:var(--danger)]">
            נסו לשמור שוב
          </button>
        )}
      </div>
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={slides.length === 0}
          onClick={() => setPresentAt(0)}
          className="rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
        >
          🖥️ הקרנה במסך מלא
        </button>
        <Link
          href={studentCopy ? `/dashboard/exams/student-deck/${studentCopy.examId}/print` : `/dashboard/exams/deck/${deckId}/print`}
          target="_blank"
          className="rounded-full border-2 border-[color:var(--primary)]/50 px-5 py-2 text-sm font-bold text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
        >
          🖨 הדפסה / PDF
        </Link>
        <Link href="/dashboard/exams" className="text-sm font-semibold text-[color:var(--primary)] underline">
          חזרה למבחנים
        </Link>
      </div>

      {studentCopy && (
        <div className="no-print mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
          <button
            type="button"
            role="switch"
            aria-checked={published}
            disabled={pubBusy}
            onClick={() => void togglePublished()}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-2 text-sm font-bold text-[color:var(--primary)] disabled:opacity-70"
          >
            <span
              aria-hidden
              className={`relative inline-block h-5 w-9 rounded-full transition ${published ? "bg-[color:var(--success)]" : "bg-[color:var(--foreground)]/30"}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${published ? "end-0.5" : "start-0.5"}`} />
            </span>
            {pubBusy ? "שומר…" : "פרסום לתלמידים"}
            <span className="text-xs font-semibold">{published ? "(מפורסם)" : "(מוסתר)"}</span>
          </button>
          <button
            type="button"
            disabled={syncBusy}
            onClick={() => void syncFromSource()}
            className="inline-flex items-center gap-2 rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-2 text-sm font-bold text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10 disabled:opacity-70"
          >
            {syncBusy && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
            {syncBusy ? "מעדכן…" : "עדכון מהמצגת שלי"}
          </button>
          {note && (
            <span aria-live="polite" className="text-sm font-semibold">
              {note}
            </span>
          )}
        </div>
      )}

      <ol className="space-y-3">
        {slides.map((s, i) => {
          const open = openId === s.id;
          return (
            <li
              key={s.id}
              onDragOver={(e) => {
                if (dragId) {
                  e.preventDefault();
                  setOverId(s.id);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(s.id);
                setDragId(null);
                setOverId(null);
              }}
              className={`rounded-2xl border bg-[color:var(--card)] p-4 shadow-sm ${
                overId === s.id && dragId && dragId !== s.id ? "border-[color:var(--accent)] border-dashed" : "border-[color:var(--border)]"
              } ${dragId === s.id ? "opacity-50" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span
                  draggable
                  onDragStart={(e) => {
                    setDragId(s.id);
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", s.id);
                  }}
                  onDragEnd={() => {
                    setDragId(null);
                    setOverId(null);
                  }}
                  title="גררו לשינוי הסדר"
                  aria-label="גררו לשינוי הסדר"
                  className="cursor-grab select-none pt-1 text-xl text-[color:var(--foreground)]/50"
                >
                  ⠿
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold text-[color:var(--primary)]">
                    {i + 1}. {s.title || "שקופית ללא כותרת"}
                  </p>
                  {!open && s.bullets.length > 0 && (
                    <p className="mt-1 truncate text-sm text-[color:var(--foreground)]/70">{s.bullets.map((b) => b.text).join(" · ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="הזזה למעלה" className="rounded-full px-2 py-1 text-xs font-bold disabled:opacity-30">
                    ▲
                  </button>
                  <button type="button" onClick={() => move(s.id, 1)} disabled={i === slides.length - 1} aria-label="הזזה למטה" className="rounded-full px-2 py-1 text-xs font-bold disabled:opacity-30">
                    ▼
                  </button>
                  <button type="button" onClick={() => setPresentAt(i)} className="rounded-full border border-[color:var(--primary)]/50 px-3 py-1 text-xs font-bold text-[color:var(--primary)]">
                    הצגה
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : s.id)}
                    aria-expanded={open}
                    className="rounded-full bg-[color:var(--primary-fill)] px-3 py-1 text-xs font-bold text-white"
                  >
                    {open ? "סגירה" : "עריכה"}
                  </button>
                  <button type="button" onClick={() => removeSlide(s.id)} className="rounded-full border border-[color:var(--danger)]/60 px-3 py-1 text-xs font-bold text-[color:var(--danger)]">
                    מחיקה
                  </button>
                </div>
              </div>
              {open && <SlideFields slide={s} onPatch={(p) => patch(s.id, p)} />}
            </li>
          );
        })}
      </ol>
      {slides.length === 0 && <p className="text-center">אין עדיין שקופיות.</p>}

      <div className="no-print mt-6 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={addSlide}
          disabled={slides.length >= MAX_SLIDES}
          className="rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
        >
          + הוספת שקופית
        </button>
        {!studentCopy && (
          <button
            type="button"
            onClick={deleteDeck}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--danger)]/60 px-4 py-2 text-xs font-bold text-[color:var(--danger)] disabled:opacity-60"
          >
            {deleting && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current/30 border-t-current" />}
            {deleting ? "מוחק…" : "מחיקת המצגת"}
          </button>
        )}
      </div>

      {presentAt !== null && <Presenter slides={slides} start={presentAt} onClose={() => setPresentAt(null)} />}
    </div>
  );
}

// Edit fields of one slide. The bullets textarea keeps its own raw text so
// blank lines / indentation survive while typing.
function SlideFields({ slide, onPatch }: { slide: DeckSlide; onPatch: (p: Partial<DeckSlide>) => void }) {
  const [text, setText] = useState(() => bulletsToText(slide.bullets));
  const field = "w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2";
  return (
    <div className="mt-4 space-y-3 border-t border-[color:var(--border)]/60 pt-4">
      <label className="block text-sm font-semibold">
        כותרת
        <input value={slide.title} onChange={(e) => onPatch({ title: e.target.value })} className={`${field} mt-1 font-display text-lg font-bold`} />
      </label>
      <label className="block text-sm font-semibold">
        שורות תבליטים
        <span className="ms-2 text-xs font-normal text-[color:var(--foreground)]/60">שורה לכל תבליט. רווחים בתחילת שורה יוצרים תבליט משנה.</span>
        <textarea
          value={text}
          rows={Math.max(4, text.split("\n").length + 1)}
          onChange={(e) => {
            setText(e.target.value);
            onPatch({ bullets: textToBullets(e.target.value) });
          }}
          className={`${field} mt-1 text-base leading-relaxed`}
        />
      </label>
      <label className="block text-sm font-semibold">
        הערות דובר
        <span className="ms-2 text-xs font-normal text-[color:var(--foreground)]/60">לא מוצגות בהקרנה ולא בהדפסה.</span>
        <textarea value={slide.notes} rows={3} onChange={(e) => onPatch({ notes: e.target.value })} className={`${field} mt-1 text-sm`} />
      </label>
    </div>
  );
}

// Full-screen presenting: one slide at a time, no speaker notes.
function Presenter({ slides, start, onClose }: { slides: DeckSlide[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(start, slides.length - 1));
  const root = useRef<HTMLDivElement>(null);
  const total = slides.length;
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(total - 1, x + d))), [total]);

  useEffect(() => {
    const el = root.current;
    let entered = false;
    if (el?.requestFullscreen) {
      el.requestFullscreen().then(() => (entered = true)).catch(() => {});
    }
    const onFs = () => {
      if (entered && !document.fullscreenElement) onClose();
    };
    document.addEventListener("fullscreenchange", onFs);
    return () => {
      document.removeEventListener("fullscreenchange", onFs);
      entered = false;
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, [onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // RTL deck: the left arrow moves forward, the right arrow back
      if (e.key === "ArrowLeft" || e.key === "PageDown" || e.key === " " || e.key === "Enter" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowRight" || e.key === "PageUp" || e.key === "ArrowUp" || e.key === "Backspace") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setI(0);
      else if (e.key === "End") setI(total - 1);
      else if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose, total]);

  const s = slides[i];
  if (!s) return null;
  return (
    <div
      ref={root}
      dir="rtl"
      role="dialog"
      aria-label="הקרנת מצגת"
      onClick={() => go(1)}
      className="fixed inset-0 z-[100] flex cursor-pointer select-none flex-col justify-center overflow-auto bg-[color:var(--background)] px-[8vw] py-[6vh] text-[color:var(--foreground)]"
    >
      <h2 className="mb-[4vh] font-display font-bold leading-tight text-[color:var(--primary)]" style={{ fontSize: "clamp(2rem, 5.5vw, 5rem)" }}>
        {s.title}
      </h2>
      <ul className="space-y-[2.2vh] leading-snug" style={{ fontSize: "clamp(1.4rem, 3.4vw, 3.2rem)" }}>
        {s.bullets.map((b, j) => (
          <li key={j} className={`flex gap-4 ${b.level === 1 ? "ps-[4vw] opacity-90" : ""}`} style={b.level === 1 ? { fontSize: "0.85em" } : undefined}>
            <span aria-hidden className="text-[color:var(--accent)]">
              {b.level === 1 ? "–" : "•"}
            </span>
            <span>{b.text}</span>
          </li>
        ))}
      </ul>
      <span className="fixed bottom-4 left-5 text-lg font-semibold opacity-70" dir="ltr">
        {i + 1} / {total}
      </span>
      <button
        type="button"
        aria-label="סגירת ההקרנה"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="fixed right-4 top-4 rounded-full border border-[color:var(--border)] px-3 py-1 text-sm opacity-50 hover:opacity-100"
      >
        ✕ יציאה
      </button>
    </div>
  );
}
