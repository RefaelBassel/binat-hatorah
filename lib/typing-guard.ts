import { db } from "./db";
import { now } from "./tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "./content-overrides";
import type { QuestionBlock, TaskContent } from "@/content/tasks/types";

// Server-side half of the paste defence. The browser-side guard
// (components/task/answer-guard.tsx) stops every paste, drop and injection
// it can see — but the browser belongs to the student, so nothing there is
// final. This is the part a script cannot fake: the SERVER clock.
//
// Every accepted save records how many characters of NEW text it added
// (text from the task's own verses/sources, and text the student already
// wrote, is free — copying a verse or moving a sentence is legitimate).
// A save that costs more than the character budget a person could have
// typed since the last one is refused; a pace a person rarely sustains
// over five minutes is flagged for the teacher.
// Thresholds agreed with Rafael (2026-10-07): refuse above 8 chars/second,
// flag above 5. A patient script that "types" at a human pace is not
// stopped by anything here — nor could it be — but it then costs the
// cheater the same minutes as writing.

export const REJECT_CPS = 8;
export const FLAG_CPS = 5;
// A token bucket: the student holds a budget of characters that refills at
// REJECT_CPS and never exceeds BUCKET_CAP. A save costing more than the
// budget is refused. Continuous typing at any human pace never empties
// the bucket (it refills faster than people type); a pasted essay does.
// The cap is what one long pause (or a network outage) may bank — about
// 40 seconds of refill. A fresh task starts with a small budget.
export const BUCKET_CAP = 300;
const BUCKET_START = 120;
const FLAG_HORIZON = 300; // seconds: pace over this span sets the teacher flag
const SLACK = 20;
const SEEN_CAP = 200_000;

export const RATE_REJECT_MESSAGE =
  "הטקסט נוסף מהר מדי מכדי שהוקלד — התוספת האחרונה לא נשמרה. כאן כותבים בקצב של הקלדה.";

// Nikud, taamim, punctuation and spacing all vanish, so a verse pasted from
// anywhere still matches the task's own text.
export function normalizeForPaste(s: string): string {
  return s
    .replace(/[֑-ׇ]/g, "")
    .replace(/[^א-תa-zA-Z0-9]/g, "")
    .toLowerCase();
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

// The text that `next` added relative to `prev` (common prefix and suffix
// stripped). A pure deletion yields "".
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

let ready = false;
async function ensureTables() {
  if (ready) return;
  await db().execute(
    `CREATE TABLE IF NOT EXISTS typing_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       task_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       at INTEGER NOT NULL,
       chars INTEGER NOT NULL
     )`
  );
  await db().execute(
    "CREATE INDEX IF NOT EXISTS idx_typing_events_user ON typing_events(task_id, user_id, at)"
  );
  await db().execute(
    `CREATE TABLE IF NOT EXISTS typing_stats (
       task_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       typed_chars INTEGER NOT NULL DEFAULT 0,     -- inserted 1-2 chars at a time
       bulk_chars INTEGER NOT NULL DEFAULT 0,      -- inserted 3-30 chars at a time (autocorrect, dictation)
       allowed_chars INTEGER NOT NULL DEFAULT 0,   -- verses / sources / own text pasted
       blocked_inserts INTEGER NOT NULL DEFAULT 0, -- paste/drop/injection stopped in the browser
       rejected_saves INTEGER NOT NULL DEFAULT 0,  -- saves refused here for pace
       peak_cpm INTEGER NOT NULL DEFAULT 0,        -- fastest minute observed (chars)
       flagged INTEGER NOT NULL DEFAULT 0,
       tokens REAL NOT NULL DEFAULT 120,           -- the character budget (token bucket)
       tokens_at INTEGER NOT NULL DEFAULT 0,       -- when the budget was last computed
       seen TEXT NOT NULL DEFAULT '',              -- normalized text already accepted
       updated_at INTEGER NOT NULL,
       PRIMARY KEY (task_id, user_id)
     )`
  );
  ready = true;
}

async function ensureRow(taskId: number, userId: number) {
  await ensureTables();
  await db().execute({
    sql: `INSERT INTO typing_stats (task_id, user_id, updated_at) VALUES (?, ?, ?)
          ON CONFLICT(task_id, user_id) DO NOTHING`,
    args: [taskId, userId, now()],
  });
}

// ---------- the task's free text (verses, sources, help verses, essay source) ----------
const corpusCache = new Map<string, { at: number; text: string }>();
export async function taskCorpus(contentRef: string): Promise<string> {
  const hit = corpusCache.get(contentRef);
  if (hit && Date.now() - hit.at < 5 * 60_000) return hit.text;
  const reg = getTaskContent(contentRef);
  if (!reg) return "";
  const content: TaskContent = await effectiveContent(reg.content);
  const parts: string[] = [];
  // verse numbers ride along when a student selects verses on the page
  const addVerses = (vs: { num?: string; text: string }[]) =>
    vs.forEach((v) => parts.push(`${v.num ?? ""} ${v.text}`));
  parts.push(reg.mainPassage.ref);
  addVerses(reg.mainPassage.verses);
  for (const sec of content.sections ?? []) {
    for (const b of sec.blocks) {
      if (b.type === "passage") {
        parts.push(b.ref);
        addVerses(b.verses);
      }
      if (b.type === "source") parts.push(b.title, b.text);
      if (b.type === "question" && (b as QuestionBlock).helpVerses) {
        parts.push((b as QuestionBlock).helpVerses!.ref);
        addVerses((b as QuestionBlock).helpVerses!.verses);
      }
    }
  }
  const w = (content as { writing?: { source?: { title?: string; byline?: string; paragraphs?: string[] } } }).writing;
  if (w?.source) {
    if (w.source.title) parts.push(w.source.title);
    if (w.source.byline) parts.push(w.source.byline);
    for (const p of w.source.paragraphs ?? []) parts.push(p);
  }
  const text = normalizeForPaste(parts.join(" "));
  corpusCache.set(contentRef, { at: Date.now(), text });
  return text;
}

// ---------- the check itself ----------
export async function checkAnswerSave(opts: {
  taskId: number;
  userId: number;
  prev: string;
  next: string;
  corpus: string;
}): Promise<{ ok: true; flagged: boolean } | { ok: false; message: string }> {
  const { taskId, userId, prev, next, corpus } = opts;
  await ensureRow(taskId, userId);
  const ins = insertedText(prev, next);
  if (ins.length === 0) return { ok: true, flagged: false };
  const norm = normalizeForPaste(ins);
  const row = (
    await db().execute({
      sql: "SELECT seen, flagged, tokens, tokens_at FROM typing_stats WHERE task_id = ? AND user_id = ?",
      args: [taskId, userId],
    })
  ).rows[0];
  const seen = String(row?.seen ?? "");
  const wasFlagged = Number(row?.flagged ?? 0) === 1;
  const t = now();
  const rememberSeen = async () => {
    if (!norm) return;
    await db().execute({
      sql: "UPDATE typing_stats SET seen = substr(seen || ?, -?), updated_at = ? WHERE task_id = ? AND user_id = ?",
      args: [norm, SEEN_CAP, t, taskId, userId],
    });
  };
  // free: the task's own verses/sources, or text the student already wrote
  // here (moving a sentence, undoing a deletion, reusing an earlier step)
  if (norm.length === 0 || seen.includes(norm) || coveredByCorpus(ins, corpus)) {
    await rememberSeen();
    return { ok: true, flagged: wasFlagged };
  }
  const tokensAt = Number(row?.tokens_at ?? 0);
  const tokens =
    tokensAt === 0
      ? BUCKET_START
      : Math.min(BUCKET_CAP, Number(row?.tokens ?? 0) + REJECT_CPS * Math.max(0, t - tokensAt));
  if (ins.length > tokens + SLACK) {
    // a refused save empties the budget, so a script cannot simply retry
    // every second until the bucket lets the chunk through
    await db().execute({
      sql: `UPDATE typing_stats SET rejected_saves = rejected_saves + 1, flagged = 1,
              tokens = 0, tokens_at = ?, updated_at = ?
            WHERE task_id = ? AND user_id = ?`,
      args: [t, t, taskId, userId],
    });
    return { ok: false, message: RATE_REJECT_MESSAGE };
  }
  await db().execute({
    sql: "INSERT INTO typing_events (task_id, user_id, at, chars) VALUES (?, ?, ?, ?)",
    args: [taskId, userId, t, ins.length],
  });
  const recent = await db().execute({
    sql: "SELECT COALESCE(SUM(chars), 0) AS n FROM typing_events WHERE task_id = ? AND user_id = ? AND at > ?",
    args: [taskId, userId, t - FLAG_HORIZON],
  });
  const sum = Number(recent.rows[0]?.n ?? 0);
  const flagged = wasFlagged || sum > FLAG_CPS * FLAG_HORIZON + SLACK;
  const cpm = Math.round((60 * sum) / FLAG_HORIZON);
  await db().execute({
    sql: `UPDATE typing_stats SET tokens = ?, tokens_at = ?, peak_cpm = MAX(peak_cpm, ?), flagged = ?, updated_at = ?
          WHERE task_id = ? AND user_id = ?`,
    args: [Math.max(0, tokens - ins.length), t, cpm, flagged ? 1 : 0, t, taskId, userId],
  });
  await rememberSeen();
  return { ok: true, flagged };
}

// Browser-side counters, sent as deltas with each save.
export async function recordTelemetry(
  taskId: number,
  userId: number,
  raw: unknown
) {
  if (!raw || typeof raw !== "object") return;
  const r = raw as Record<string, unknown>;
  const n = (k: string) => Math.min(Math.max(0, Math.round(Number(r[k]) || 0)), 50_000);
  const typed = n("typed");
  const bulk = n("bulk");
  const allowed = n("allowed");
  const blocked = n("blocked");
  if (typed + bulk + allowed + blocked === 0) return;
  await ensureRow(taskId, userId);
  await db().execute({
    sql: `UPDATE typing_stats SET typed_chars = typed_chars + ?, bulk_chars = bulk_chars + ?,
            allowed_chars = allowed_chars + ?, blocked_inserts = blocked_inserts + ?, updated_at = ?
          WHERE task_id = ? AND user_id = ?`,
    args: [typed, bulk, allowed, blocked, now(), taskId, userId],
  });
}

export interface TypingStats {
  typedChars: number;
  bulkChars: number;
  allowedChars: number;
  blockedInserts: number;
  rejectedSaves: number;
  peakCpm: number;
  flagged: boolean;
}

export const EMPTY_TYPING: TypingStats = {
  typedChars: 0,
  bulkChars: 0,
  allowedChars: 0,
  blockedInserts: 0,
  rejectedSaves: 0,
  peakCpm: 0,
  flagged: false,
};

export async function typingStatsFor(taskId: number): Promise<Map<number, TypingStats>> {
  await ensureTables();
  const res = await db().execute({
    sql: `SELECT user_id, typed_chars, bulk_chars, allowed_chars, blocked_inserts, rejected_saves, peak_cpm, flagged
          FROM typing_stats WHERE task_id = ?`,
    args: [taskId],
  });
  const map = new Map<number, TypingStats>();
  for (const r of res.rows) {
    map.set(Number(r.user_id), {
      typedChars: Number(r.typed_chars),
      bulkChars: Number(r.bulk_chars),
      allowedChars: Number(r.allowed_chars),
      blockedInserts: Number(r.blocked_inserts),
      rejectedSaves: Number(r.rejected_saves),
      peakCpm: Number(r.peak_cpm),
      flagged: Number(r.flagged) === 1,
    });
  }
  return map;
}

// Share of the student's own text that arrived one keystroke at a time.
export function typedShare(s: TypingStats): number | null {
  const own = s.typedChars + s.bulkChars;
  if (own < 40) return null;
  return Math.round((100 * s.typedChars) / own);
}
