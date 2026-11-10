"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicSlide } from "@/lib/student-decks";

// Student view of the review presentation (issue #53): read-only, one slide
// at a time; arrows / swipe / tap to move, slide number, full screen, print.
// Receives slides without speaker notes (stripped on the server).
export default function DeckViewer({ slides, printHref }: { slides: PublicSlide[]; printHref: string }) {
  const [i, setI] = useState(0);
  const [full, setFull] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const total = slides.length;

  // true when the page reads right to left (Hebrew); the English student's
  // page is left to right and the arrow directions flip with it
  const isRtl = useCallback(() => (root.current ? getComputedStyle(root.current).direction === "rtl" : true), []);
  const go = useCallback((d: number) => setI((x) => Math.max(0, Math.min(total - 1, x + d))), [total]);

  useEffect(() => {
    const onFs = () => setFull(document.fullscreenElement === root.current);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  function toggleFull() {
    const el = root.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {});
  }

  function onKeyDown(e: React.KeyboardEvent) {
    const fwdKey = isRtl() ? "ArrowLeft" : "ArrowRight";
    const backKey = isRtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwdKey || e.key === "PageDown" || e.key === "ArrowDown") {
      e.preventDefault();
      go(1);
    } else if (e.key === backKey || e.key === "PageUp" || e.key === "ArrowUp") {
      e.preventDefault();
      go(-1);
    } else if (e.key === "Home") setI(0);
    else if (e.key === "End") setI(total - 1);
  }

  function onTouchEnd(e: React.TouchEvent) {
    const start = touch.current;
    touch.current = null;
    if (!start) return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    // RTL: a swipe to the right reveals the next slide (it sits on the left)
    go((dx > 0) === isRtl() ? 1 : -1);
  }

  const s = slides[Math.min(i, total - 1)];
  if (!s) return null;
  const btn =
    "rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-2 text-sm font-bold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10 disabled:opacity-40";
  return (
    <div
      ref={root}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-label="מצגת חזרה"
      className={`outline-none ${full ? "flex min-h-screen flex-col bg-[color:var(--background)] p-4 sm:p-8" : ""}`}
    >
      <div className="no-print mb-3 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={toggleFull} className={btn}>
          {full ? "⤢ יציאה ממסך מלא" : "⛶ מסך מלא"}
        </button>
        <a href={printHref} target="_blank" rel="noreferrer" className={btn}>
          🖨 הדפסה / PDF
        </a>
      </div>

      <div
        onClick={() => go(1)}
        onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
        onTouchEnd={onTouchEnd}
        dir="rtl"
        role="group"
        aria-roledescription="slide"
        aria-live="polite"
        className={`flex cursor-pointer select-none flex-col justify-center rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-5 py-8 shadow-sm sm:px-10 sm:py-12 ${
          full ? "flex-1 overflow-auto px-[6vw]" : "min-h-[22rem]"
        }`}
        style={{ touchAction: "pan-y" }}
      >
        <h2
          className="mb-6 font-display font-bold leading-tight text-[color:var(--primary)]"
          style={{ fontSize: full ? "clamp(2rem, 5vw, 4.5rem)" : "clamp(1.4rem, 5vw, 2.2rem)" }}
        >
          {s.title}
        </h2>
        <ul className="space-y-3 leading-snug" style={{ fontSize: full ? "clamp(1.3rem, 3vw, 2.8rem)" : "clamp(1.05rem, 3.6vw, 1.35rem)" }}>
          {s.bullets.map((b, j) => (
            <li key={j} className={`flex gap-3 ${b.level === 1 ? "ps-6 opacity-90" : ""}`} style={b.level === 1 ? { fontSize: "0.88em" } : undefined}>
              <span aria-hidden className="text-[color:var(--accent)]">
                {b.level === 1 ? "–" : "•"}
              </span>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="no-print mt-4 flex items-center justify-center gap-3">
        <button type="button" onClick={() => go(-1)} disabled={i === 0} aria-label="השקופית הקודמת" className={btn}>
          → הקודמת
        </button>
        <span className="min-w-16 text-center text-sm font-bold" dir="ltr" aria-live="polite">
          {i + 1} / {total}
        </span>
        <button type="button" onClick={() => go(1)} disabled={i === total - 1} aria-label="השקופית הבאה" className={btn}>
          הבאה ←
        </button>
      </div>
    </div>
  );
}
