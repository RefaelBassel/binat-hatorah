"use client";

// Teacher-only QA board for the verse-audio timestamp map: every chapter,
// every verse, one play button — so a full audit of the alignment takes
// minutes. Verse text is fetched from Sefaria on chapter expand (this page
// is occasional teacher tooling; no need to bundle the whole Tanach).

import { useEffect, useState } from "react";
import {
  NARRATION_CREDIT,
  loadAudioMap,
  useVerseAudio,
  type AudioMap,
} from "./task/verse-audio";

const BOOK_HE: Record<string, string> = {
  Numbers: "במדבר",
  I_Kings: "מלכים א׳",
  II_Kings: "מלכים ב׳",
};

const UNITS = ["", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט"];
const TENS = ["", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ"];
const HUNDREDS = ["", "ק", "ר", "ש", "ת"];

function intToHebNum(n: number): string {
  let s = "";
  let v = n;
  s += HUNDREDS[Math.floor(v / 100)] ?? "";
  v %= 100;
  if (v === 15) s += "טו";
  else if (v === 16) s += "טז";
  else {
    s += TENS[Math.floor(v / 10)];
    s += UNITS[v % 10];
  }
  if (s.length >= 2) return s.slice(0, -1) + "״" + s.slice(-1);
  return s + "׳";
}

function chapterLabel(ref: string): string {
  const [book, ch] = ref.split(".");
  return `${BOOK_HE[book] ?? book} ${intToHebNum(Number(ch))}`;
}

export default function AudioQa() {
  const [map, setMap] = useState<AudioMap | null>(null);
  useEffect(() => {
    loadAudioMap().then(setMap);
  }, []);
  if (!map) {
    return <p className="text-sm text-[color:var(--foreground)]/60">טוען את מפת האודיו...</p>;
  }
  const refs = Object.keys(map).sort((a, b) => {
    const [ba, ca] = a.split(".");
    const [bb, cb] = b.split(".");
    const order = ["Numbers", "I_Kings", "II_Kings"];
    if (ba !== bb) return order.indexOf(ba) - order.indexOf(bb);
    return Number(ca) - Number(cb);
  });
  return (
    <div className="space-y-3">
      <p className="text-xs leading-6 text-[color:var(--foreground)]/60">
        כל פרק שממופה להשמעה, פסוק-פסוק. לחצו ▶ והקשיבו שהפסוק מתחיל ונגמר נקי.
        מצאתם פסוק שנחתך או גולש? כתבו לרפאל את הפרק והפסוק — התיקון נקודתי ומהיר.
        <span className="ms-2 text-[color:var(--primary)]/50">🔊 {NARRATION_CREDIT}</span>
      </p>
      {refs.map((ref) => (
        <ChapterCard key={ref} refId={ref} entry={map[ref]} />
      ))}
    </div>
  );
}

function ChapterCard({
  refId,
  entry,
}: {
  refId: string;
  entry: AudioMap[string];
}) {
  const [open, setOpen] = useState(false);
  const [texts, setTexts] = useState<string[] | null>(null);
  const vAudio = useVerseAudio();

  useEffect(() => {
    if (!open || texts) return;
    fetch(`https://www.sefaria.org/api/texts/${refId}?context=0&commentary=0`)
      .then((r) => r.json())
      .then((d) => {
        const he = Array.isArray(d.he)
          ? d.he.map((v: string) => String(v).replace(/<[^>]+>/g, ""))
          : [];
        setTexts(he);
      })
      .catch(() => setTexts([]));
  }, [open, texts, refId]);

  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-start"
      >
        <span className="font-display text-sm font-bold text-[color:var(--primary)]">
          📖 {chapterLabel(refId)}
        </span>
        <span className="text-[11px] text-[color:var(--primary)]/50">
          {entry.verses.length} פסוקים {open ? "▲" : "▼"}
        </span>
      </button>
      {open && (
        <ul className="space-y-1 border-t border-[color:var(--border)] p-4">
          {entry.verses.map((span, i) => {
            const playing = vAudio.isPlaying(refId, i);
            return (
              <li
                key={i}
                className="flex items-center gap-3 rounded-lg px-2 py-1 text-[13px] leading-6"
                style={playing ? { background: "rgba(185,106,59,0.12)" } : undefined}
              >
                <button
                  type="button"
                  onClick={() => vAudio.play(refId, i)}
                  className="shrink-0 rounded-full border border-[color:var(--accent)]/40 px-2 py-0.5 text-[11px] font-bold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10"
                >
                  {playing ? "⏸" : "▶"} {intToHebNum(i + 1)}
                </button>
                <span className="text-[10px] tabular-nums text-[color:var(--primary)]/40">
                  {span[0].toFixed(1)}–{span[1].toFixed(1)}
                </span>
                <span className="truncate text-[color:var(--foreground)]/85">
                  {texts ? texts[i] ?? "" : "..."}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
