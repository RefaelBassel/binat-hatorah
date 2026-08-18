"use client";

// Verse playback for Tanach passages — Abraham Shmuelof's narration.
// Chapter MP3s are self-hosted under /audio/tanach with a verse-level
// timestamp map (audio-map.json) built by scripts/asr_align_verses.py.
// Clicking a verse number (or a word's "השמעת הפסוק" menu item) plays
// exactly that verse; a passage-level button plays the whole span.
//
// A single shared <audio> element lives at module level: only one thing
// plays at a time, and starting a new verse stops the previous one.

import { useEffect, useState } from "react";

type VerseSpan = [number, number];
export type AudioMap = Record<string, { file: string; verses: VerseSpan[] }>;

// ---------------------------------------------------------------------------
// Hebrew numeral + reference resolution
// ---------------------------------------------------------------------------

const GEMATRIA: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

export function hebNumToInt(raw: string): number | null {
  const s = raw.replace(/[׳״'"]/g, "").trim();
  if (!s) return null;
  let sum = 0;
  for (const ch of s) {
    const v = GEMATRIA[ch];
    if (!v) return null;
    sum += v;
  }
  return sum || null;
}

type BookId = "Numbers" | "I_Kings" | "II_Kings";

export function bookIdFromHebrew(text: string): BookId | null {
  if (text.includes("במדבר")) return "Numbers";
  if (/מלכים\s*ב/.test(text)) return "II_Kings";
  if (/מלכים\s*א/.test(text)) return "I_Kings";
  return null;
}

// "Numbers.32.1-7" / "I_Kings.3.5-15" / "Numbers.9" → "Numbers.32" etc.
export function chapterFromSefariaRef(ref?: string): string | null {
  const m = ref?.match(/^([A-Za-z_]+)\.(\d+)/);
  return m ? `${m[1]}.${m[2]}` : null;
}

// Hebrew ref text like "פרק ל״ב, פסוקים א׳–ה׳" or "מלכים א׳, פרק י״ב..."
export function chapterFromHebText(
  text: string,
  bookHint: BookId | null
): string | null {
  const m = text.match(/פרק\s+([א-ת׳״'"]+)/);
  if (!m) return null;
  const n = hebNumToInt(m[1]);
  const book = bookIdFromHebrew(text) ?? bookHint;
  return book && n ? `${book}.${n}` : null;
}

// Resolve a single verse to (chapter, zero-based index).
// Handles plain nums ("טז") and multi-chapter nums ("ט׳, א׳" /
// "דברים א׳, כ״ב" — an unknown book resolves to null, gracefully).
export function resolveVerse(
  num: string,
  passageSefariaRef: string | undefined,
  ctx: { bookId: BookId | null; fallbackChapter: string | null }
): { chapter: string; idx: number } | null {
  if (num.includes(",")) {
    const [p1, p2] = num.split(",").map((s) => s.trim());
    const verse = hebNumToInt(p2);
    const chapterToken = p1.split(/\s+/).pop() ?? p1;
    const book = bookIdFromHebrew(p1) ?? (p1.match(/[^א-ת׳״'"\s]/) ? null : ctx.bookId);
    // "דברים א׳, כ״ב" — book named but not in our audio corpus
    if (/דברים|שמות|בראשית|ויקרא|יהושע|שמואל/.test(p1)) return null;
    const ch = hebNumToInt(chapterToken);
    if (!book || !ch || !verse) return null;
    return { chapter: `${book}.${ch}`, idx: verse - 1 };
  }
  const chapter =
    chapterFromSefariaRef(passageSefariaRef) ?? ctx.fallbackChapter;
  const verse = hebNumToInt(num);
  if (!chapter || !verse) return null;
  return { chapter, idx: verse - 1 };
}

// ---------------------------------------------------------------------------
// Per-task audio context (one task page at a time — a module singleton is
// simpler than threading props through every stage component)
// ---------------------------------------------------------------------------

let taskCtx: { bookId: BookId | null; fallbackChapter: string | null } = {
  bookId: null,
  fallbackChapter: null,
};

export function setVerseAudioContext(bookRef: string, mainSefariaRef?: string) {
  taskCtx = {
    bookId: bookIdFromHebrew(bookRef),
    fallbackChapter: chapterFromSefariaRef(mainSefariaRef),
  };
}

export function getVerseAudioContext() {
  return taskCtx;
}

// ---------------------------------------------------------------------------
// Playback singleton
// ---------------------------------------------------------------------------

let mapCache: AudioMap | null = null;
let mapPromise: Promise<AudioMap> | null = null;
let audioEl: HTMLAudioElement | null = null;
let current: { chapter: string; from: number; to: number } | null = null;
let endAt = 0;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function loadAudioMap(): Promise<AudioMap> {
  if (mapCache) return Promise.resolve(mapCache);
  if (!mapPromise) {
    // no-store: the map is tiny and its timestamps get tuned — a stale
    // cached copy silently plays wrong verse boundaries
    mapPromise = fetch("/audio/tanach/audio-map.json", { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<AudioMap>) : {}))
      .then((m) => (mapCache = m ?? {}))
      .catch(() => (mapCache = {}));
  }
  return mapPromise;
}

function ensureAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.preload = "auto";
    audioEl.addEventListener("timeupdate", () => {
      if (current && audioEl && audioEl.currentTime >= endAt - 0.02) {
        stopVerseAudio();
      }
    });
    audioEl.addEventListener("ended", stopVerseAudio);
    audioEl.addEventListener("error", stopVerseAudio);
  }
  return audioEl;
}

export function stopVerseAudio() {
  audioEl?.pause();
  if (current) {
    current = null;
    notify();
  }
}

// Play verses [from..to] (zero-based, inclusive) of a chapter.
// Calling again with the same span toggles (stops).
export async function playVerseSpan(
  chapter: string,
  from: number,
  to: number = from
): Promise<boolean> {
  const map = await loadAudioMap();
  const entry = map[chapter];
  if (!entry?.verses[from] || !entry.verses[to]) return false;
  if (
    current &&
    current.chapter === chapter &&
    current.from === from &&
    current.to === to
  ) {
    stopVerseAudio();
    return true;
  }
  const el = ensureAudio();
  const abs = new URL(entry.file, window.location.origin).href;
  const start = entry.verses[from][0];
  endAt = entry.verses[to][1];
  const seekAndPlay = () => {
    el.currentTime = start;
    el.play().catch(() => stopVerseAudio());
  };
  if (el.src !== abs) {
    el.src = abs;
    el.addEventListener("loadedmetadata", seekAndPlay, { once: true });
    el.load();
  } else {
    seekAndPlay();
  }
  current = { chapter, from, to };
  notify();
  return true;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function useVerseAudio() {
  const [, setTick] = useState(0);
  const [map, setMap] = useState<AudioMap | null>(mapCache);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    let alive = true;
    loadAudioMap().then((m) => {
      if (alive) setMap(m);
    });
    return () => {
      alive = false;
      listeners.delete(l);
    };
  }, []);
  return {
    map,
    playing: current,
    play: playVerseSpan,
    stop: stopVerseAudio,
    has: (chapter: string | null, idx: number) =>
      Boolean(chapter && map?.[chapter]?.verses[idx]),
    isPlaying: (chapter: string | null, idx: number) =>
      Boolean(
        chapter &&
          current &&
          current.chapter === chapter &&
          current.from <= idx &&
          idx <= current.to
      ),
  };
}

export const NARRATION_CREDIT = "קריינות: אברהם שמואלוף";
