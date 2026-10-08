"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Browser-side half of the paste defence (the server half is
// lib/typing-guard.ts). One hook guards a whole task page:
//
//  * answer fields: paste, drop and programmatic insertion (beforeinput)
//    are stopped unless the text is from the task's own verses/sources or
//    the student's own words; any single change that adds more than
//    MAX_JUMP characters of other text is reverted — that catches scripts
//    that set the field's value directly;
//  * question text: copying, cutting and dragging it out are stopped
//    (verses, sources and the Claude chat stay copyable — they carry
//    data-copy-free / data-paste-free);
//  * counters (typed one key at a time / in small chunks / free text /
//    blocked attempts) ride along with every save so the teacher sees how
//    the text came to be.
//
// Everything here is a courtesy fence, not a wall: the browser belongs to
// the student. The wall is the server clock in lib/typing-guard.ts.

export const MAX_JUMP = 30;

export function normalizeForPaste(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^א-תa-zA-Z0-9]/g, "")
    .toLowerCase();
}

export function insertedText(prev: string, next: string): string {
  const max = Math.min(prev.length, next.length);
  let p = 0;
  while (p < max && prev.charCodeAt(p) === next.charCodeAt(p)) p++;
  let s = 0;
  while (
    s < max - p &&
    prev.charCodeAt(prev.length - 1 - s) === next.charCodeAt(next.length - 1 - s)
  )
    s++;
  return next.slice(p, next.length - s);
}

// A pasted block may carry labels that are not verse text: verse numbers,
// a source title, a Sefaria link, a "📖 פרק ..." caption. So rather than
// demanding the whole paste be one substring of the corpus, we require
// that nearly all of it is made of runs of consecutive words found there:
// at most 15% (and at most 40 characters) of other text may ride along.
export function coveredByCorpus(text: string, corpus: string): boolean {
  const whole = normalizeForPaste(text);
  if (whole.length === 0) return true;
  if (corpus.includes(whole)) return true;
  const words = text.split(/\s+/).map(normalizeForPaste).filter(Boolean);
  let covered = 0;
  let i = 0;
  while (i < words.length) {
    let run = "";
    let j = i;
    while (j < words.length && corpus.includes(run + words[j])) {
      run += words[j];
      j++;
    }
    if (j > i && (run.length >= 12 || j - i >= 3)) {
      covered += run.length;
      i = j;
    } else {
      i++;
    }
  }
  const other = whole.length - covered;
  return other <= Math.min(40, Math.ceil(whole.length * 0.15));
}

export type GuardNoticeKind = "paste" | "jump" | "copy" | "rate";

export interface GuardTelemetry {
  typed: number;
  bulk: number;
  allowed: number;
  blocked: number;
}

export interface AnswerGuard {
  active: boolean;
  // spread on the task page's root element
  rootProps: { ref: React.RefCallback<HTMLDivElement>; "data-guard": "on" | "off" };
  // run every controlled-field change through this; it returns the value to keep
  filterChange: (prev: string, next: string) => string;
  notify: (kind: GuardNoticeKind) => void;
  notice: GuardNoticeKind | null;
  // counters since the last take (deltas); give them back if the send failed
  takeTelemetry: () => GuardTelemetry;
  giveBack: (t: GuardTelemetry) => void;
}

const ZERO: GuardTelemetry = { typed: 0, bulk: 0, allowed: 0, blocked: 0 };
const SEEN_CAP = 200_000;

function isAnswerField(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return false;
  if (t.tagName !== "TEXTAREA" && t.tagName !== "INPUT") return false;
  return !t.closest('[data-paste-free="true"]');
}

function insideFree(node: Node | null | undefined): boolean {
  if (!node) return false;
  const el = (node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode) as HTMLElement | null;
  return Boolean(el?.closest?.('[data-copy-free="true"], [data-paste-free="true"]'));
}

export function useAnswerGuard(opts: {
  active: boolean;
  corpus: string; // normalized task text (verses, sources)
  ownText: () => string; // normalized text the student has written so far
  report?: (kind: "paste-blocked" | "copy-blocked") => void;
}): AnswerGuard {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const seen = useRef(""); // normalized text already accepted (undo stays free)
  const telemetry = useRef<GuardTelemetry>({ ...ZERO });
  const [notice, setNotice] = useState<GuardNoticeKind | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((kind: GuardNoticeKind) => {
    setNotice(kind);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 5000);
  }, []);

  const isFree = useCallback((text: string) => {
    const n = normalizeForPaste(text);
    if (n.length === 0) return true;
    const o = optsRef.current;
    if (seen.current.includes(n) || o.ownText().includes(n)) return true;
    return coveredByCorpus(text, o.corpus);
  }, []);

  const blockedInsert = useCallback(
    (e: Event, kind: GuardNoticeKind) => {
      e.preventDefault();
      e.stopPropagation();
      telemetry.current.blocked += 1;
      notify(kind);
      optsRef.current.report?.("paste-blocked");
    },
    [notify]
  );

  const rootEl = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    rootEl.current = el;
  }, []);

  useEffect(() => {
    const el = rootEl.current;
    if (!el) return;
    const onPaste = (e: ClipboardEvent) => {
      if (!optsRef.current.active || !isAnswerField(e.target)) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.trim().split(/\s+/).length <= 2 && text.length <= MAX_JUMP) return;
      if (isFree(text)) {
        telemetry.current.allowed += text.length;
        return;
      }
      blockedInsert(e, "paste");
    };
    const onDrop = (e: DragEvent) => {
      if (!optsRef.current.active || !isAnswerField(e.target)) return;
      const text = e.dataTransfer?.getData("text") ?? "";
      if (text.length <= 2 || isFree(text)) return;
      blockedInsert(e, "paste");
    };
    const onBeforeInput = (e: InputEvent) => {
      if (!optsRef.current.active || !isAnswerField(e.target)) return;
      const type = e.inputType || "";
      if (!/^insertFrom(Paste|Drop|Yank)/.test(type)) return;
      let data = e.data ?? "";
      if (!data && e.dataTransfer) data = e.dataTransfer.getData("text/plain") || "";
      if (data.length <= 2 || isFree(data)) return;
      blockedInsert(e, "paste");
    };
    const onCopy = (e: ClipboardEvent) => {
      if (!optsRef.current.active) return;
      const target = e.target as HTMLElement | null;
      if (isAnswerField(target)) return; // the student's own words
      if (target?.closest?.('[data-copy-free="true"], [data-paste-free="true"]')) return;
      const sel = document.getSelection();
      if (sel && insideFree(sel.anchorNode) && insideFree(sel.focusNode)) return;
      e.preventDefault();
      notify("copy");
      optsRef.current.report?.("copy-blocked");
    };
    const onDragStart = (e: DragEvent) => {
      if (!optsRef.current.active) return;
      const target = e.target as HTMLElement | null;
      if (isAnswerField(target)) return;
      if (target?.closest?.('[data-copy-free="true"], [data-paste-free="true"]')) return;
      e.preventDefault();
      notify("copy");
      optsRef.current.report?.("copy-blocked");
    };
    el.addEventListener("paste", onPaste, true);
    el.addEventListener("drop", onDrop, true);
    el.addEventListener("beforeinput", onBeforeInput as EventListener, true);
    el.addEventListener("copy", onCopy, true);
    el.addEventListener("cut", onCopy, true);
    el.addEventListener("dragstart", onDragStart, true);
    return () => {
      el.removeEventListener("paste", onPaste, true);
      el.removeEventListener("drop", onDrop, true);
      el.removeEventListener("beforeinput", onBeforeInput as EventListener, true);
      el.removeEventListener("copy", onCopy, true);
      el.removeEventListener("cut", onCopy, true);
      el.removeEventListener("dragstart", onDragStart, true);
    };
  }, [isFree, blockedInsert, notify]);

  const filterChange = useCallback(
    (prev: string, next: string) => {
      if (!optsRef.current.active || prev === next) return next;
      const ins = insertedText(prev, next);
      if (ins.length === 0) return next;
      const remember = () => {
        const n = normalizeForPaste(ins);
        if (n) seen.current = (seen.current + n).slice(-SEEN_CAP);
      };
      if (ins.length <= 2) {
        telemetry.current.typed += ins.length;
        remember();
        return next;
      }
      if (isFree(ins)) {
        telemetry.current.allowed += ins.length;
        return next;
      }
      if (ins.length <= MAX_JUMP) {
        telemetry.current.bulk += ins.length;
        remember();
        return next;
      }
      telemetry.current.blocked += 1;
      notify("jump");
      optsRef.current.report?.("paste-blocked");
      return prev;
    },
    [isFree, notify]
  );

  const takeTelemetry = useCallback(() => {
    const t = telemetry.current;
    telemetry.current = { ...ZERO };
    return t;
  }, []);
  const giveBack = useCallback((t: GuardTelemetry) => {
    const c = telemetry.current;
    telemetry.current = {
      typed: c.typed + t.typed,
      bulk: c.bulk + t.bulk,
      allowed: c.allowed + t.allowed,
      blocked: c.blocked + t.blocked,
    };
  }, []);

  return {
    active: opts.active,
    rootProps: { ref: setRoot, "data-guard": opts.active ? "on" : "off" },
    filterChange,
    notify,
    notice,
    takeTelemetry,
    giveBack,
  };
}

const TEXTS: Record<GuardNoticeKind, { title: string; body: string }> = {
  paste: {
    title: "✍️ כאן כותבים במילים שלכם",
    body: "הדבקה מותרת רק לפסוקים ולמקורות מתוך המשימה, ולמה שכבר כתבתם כאן. במילים שלך — זה בדיוק מה שמעניין את המורה (ואת קלוד 😉).",
  },
  jump: {
    title: "✍️ הטקסט נוסף בבת אחת ולא הוקלד",
    body: "התוספת בוטלה. כאן כותבים במילים שלכם, תו אחר תו. פסוקים ומקורות מתוך המשימה אפשר להדביק.",
  },
  copy: {
    title: "📋 את השאלות לא מעתיקים החוצה",
    body: "הפסוקים והמקורות מותרים להעתקה. השאלה עצמה נועדה לך — ואת התשובה כותבים כאן.",
  },
  rate: {
    title: "⏱ הטקסט נוסף מהר מדי מכדי שהוקלד",
    body: "התוספת האחרונה לא נשמרה. כאן כותבים בקצב של הקלדה — אפשר להמשיך לכתוב.",
  },
};

export function GuardNotice({ kind }: { kind: GuardNoticeKind | null }) {
  if (!kind) return null;
  const t = TEXTS[kind];
  return (
    <div
      role="status"
      className="fixed bottom-5 left-1/2 z-[70] w-[min(420px,92vw)] -translate-x-1/2 rounded-2xl border border-[color:var(--accent)]/40 bg-[color:var(--card)] px-5 py-3 text-center text-sm shadow-2xl"
    >
      <p className="font-bold text-[color:var(--primary)]">{t.title}</p>
      <p className="mt-0.5 text-xs text-[color:var(--foreground)]/70">{t.body}</p>
    </div>
  );
}
