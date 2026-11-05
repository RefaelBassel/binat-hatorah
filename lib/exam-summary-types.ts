// Client-safe shapes for the students' exam summaries (issue #28).

export type SummaryField = "whatHappened" | "keyVerse" | "commentator" | "message" | "notes";

export const SUMMARY_FIELDS: { key: SummaryField; label: string; hint: string; rows: number }[] = [
  { key: "whatHappened", label: "מה קרה", hint: "2–3 משפטים", rows: 3 },
  { key: "keyVerse", label: "פסוק מפתח", hint: "", rows: 2 },
  { key: "commentator", label: "הפרשנים ומה הם אומרים", hint: "", rows: 2 },
  { key: "message", label: "המסר או הערך", hint: "", rows: 2 },
  { key: "notes", label: "הערות", hint: "שדה חופשי", rows: 2 },
];

export type SummaryValues = Record<SummaryField, string>;

export function emptySummary(): SummaryValues {
  return { whatHappened: "", keyVerse: "", commentator: "", message: "", notes: "" };
}

export function isSummaryField(v: unknown): v is SummaryField {
  return typeof v === "string" && SUMMARY_FIELDS.some((f) => f.key === v);
}

export const SUMMARY_MAX_LEN = 4000;
// the commentator field stores a JSON list, so it gets a larger ceiling
export const COMMENTATOR_MAX_LEN = 20000;
export function maxLenFor(field: SummaryField): number {
  return field === "commentator" ? COMMENTATOR_MAX_LEN : SUMMARY_MAX_LEN;
}

// ── Commentators: several rows per unit ────────────────────────────────
// Stored in the existing `commentator` column as a JSON array of
// {name, says}. Older rows hold plain text; it is moved into the first row.
export interface CommentatorRow {
  name: string;
  says: string;
}
export const MAX_COMMENTATOR_ROWS = 10;

export function parseCommentators(raw: string): CommentatorRow[] {
  const text = raw ?? "";
  if (text.trim() === "") return [];
  if (text.trimStart().startsWith("[")) {
    try {
      const arr: unknown = JSON.parse(text);
      if (Array.isArray(arr)) {
        return arr
          .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
          .map((r) => ({ name: String(r.name ?? ""), says: String(r.says ?? "") }));
      }
    } catch {
      // plain text that merely starts with "[": fall through
    }
  }
  // legacy free text: split "name: text" when clearly possible, else keep it all
  const m = /^\s*([^:：\n]{1,30}?)\s*[:：]\s*([\s\S]+)$/.exec(text);
  if (m && m[2].trim() !== "") return [{ name: m[1].trim(), says: m[2] }];
  return [{ name: "", says: text }];
}

// "" when every row is empty, so an untouched card never counts as started
export function serializeCommentators(rows: CommentatorRow[]): string {
  const kept = rows.slice(0, MAX_COMMENTATOR_ROWS);
  if (kept.every((r) => r.name.trim() === "" && r.says.trim() === "")) return "";
  return JSON.stringify(kept.map((r) => ({ name: r.name, says: r.says })));
}

// Print / teacher view: one "name: says" line per non-empty row
export function commentatorLines(raw: string): string[] {
  return parseCommentators(raw)
    .filter((r) => r.name.trim() !== "" || r.says.trim() !== "")
    .map((r) => (r.name.trim() && r.says.trim() ? `${r.name.trim()}: ${r.says.trim()}` : r.name.trim() || r.says.trim()));
}

export interface SummaryUnit {
  key: string;
  title: string;
  chapters: string; // shown beside the title
  taskRef: string; // content_ref of the task that teaches the unit
}

// The units each exam covers, by the exam's seed key. An exam without an
// entry here has no summary area.
const BAMIDBAR_UNITS: SummaryUnit[] = [
  { key: "pesach-sheni", title: "פסח שני", chapters: "פרק ט׳", taskRef: "lesson-01" },
  { key: "masa-hamachanot", title: "מסע המחנות", chapters: "פרקים ט׳–י׳", taskRef: "lesson-02" },
  { key: "mitavim", title: "המתאוננים והמתאווים", chapters: "פרק י״א", taskRef: "lesson-03" },
  { key: "miriam-aharon", title: "מרים ואהרן", chapters: "פרק י״ב", taskRef: "lesson-04" },
  { key: "meraglim", title: "המרגלים", chapters: "פרקים י״ג–י״ד", taskRef: "lesson-05" },
  { key: "lo-taturu", title: "וְלֹא תָתוּרוּ", chapters: "פרק ט״ו", taskRef: "lesson-06" },
  { key: "korach", title: "קרח ועדתו", chapters: "פרק ט״ז", taskRef: "lesson-07" },
];

export const EXAM_SUMMARY_UNITS: Record<string, SummaryUnit[]> = {
  "bamidbar-9-14-exam": BAMIDBAR_UNITS,
};

export function summaryUnitsFor(seedKey: string | null | undefined): SummaryUnit[] {
  return (seedKey && EXAM_SUMMARY_UNITS[seedKey]) || [];
}
