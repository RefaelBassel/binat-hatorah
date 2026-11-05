// Client-safe shapes for the students' exam summaries (issue #28).

export type SummaryField = "whatHappened" | "keyVerse" | "commentator" | "message" | "notes";

export const SUMMARY_FIELDS: { key: SummaryField; label: string; hint: string; rows: number }[] = [
  { key: "whatHappened", label: "מה קרה", hint: "2–3 משפטים", rows: 3 },
  { key: "keyVerse", label: "פסוק מפתח", hint: "", rows: 2 },
  { key: "commentator", label: "הפרשן ומה הוא אומר במשפט אחד", hint: "", rows: 2 },
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
