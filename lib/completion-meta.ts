// Client-safe half of lib/completion.ts: the completion-status and
// answer-mark vocabulary (issue #24), shared by server pages and client
// components. No DB access here.

export type CompletionStatus = "done" | "partial" | "not_done";
export type AnswerMark = "correct" | "incorrect" | "partial" | "irrelevant";
export interface MarkEntry {
  mark: AnswerMark;
  note: string;
}
export type Marks = Record<string, MarkEntry>;

export const COMPLETION_STATUSES: CompletionStatus[] = ["done", "partial", "not_done"];
export const ANSWER_MARKS: AnswerMark[] = ["correct", "incorrect", "partial", "irrelevant"];

// palette tokens (app/globals.css) so the tags follow dark mode
export const COMPLETION_META: Record<CompletionStatus, { label: string; color: string; bg: string }> = {
  done: { label: "בוצע", color: "var(--status-graded)", bg: "var(--status-graded-bg)" },
  partial: { label: "בוצע חלקית", color: "var(--status-in-progress)", bg: "var(--status-in-progress-bg)" },
  not_done: { label: "לא בוצע", color: "var(--status-overdue)", bg: "var(--status-overdue-bg)" },
};

export const MARK_META: Record<AnswerMark, { label: string; symbol: string; color: string; bg: string }> = {
  correct: { label: "נכון", symbol: "✓", color: "var(--status-graded)", bg: "var(--status-graded-bg)" },
  incorrect: { label: "לא נכון", symbol: "✗", color: "var(--status-overdue)", bg: "var(--status-overdue-bg)" },
  partial: { label: "חלקי", symbol: "◐", color: "var(--status-in-progress)", bg: "var(--status-in-progress-bg)" },
  irrelevant: { label: "לא רלוונטי", symbol: "⊘", color: "var(--status-not-started)", bg: "var(--status-not-started-bg)" },
};

export function isCompletionStatus(v: unknown): v is CompletionStatus {
  return typeof v === "string" && (COMPLETION_STATUSES as string[]).includes(v);
}

export function isAnswerMark(v: unknown): v is AnswerMark {
  return typeof v === "string" && (ANSWER_MARKS as string[]).includes(v);
}

// Accepts the stored JSON or a request body; drops anything malformed.
export function parseMarks(raw: unknown): Marks {
  let obj: unknown = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const out: Marks = {};
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const e = (v ?? {}) as Record<string, unknown>;
    if (!k || !isAnswerMark(e.mark)) continue;
    out[k.slice(0, 120)] = {
      mark: e.mark,
      note: typeof e.note === "string" ? e.note.trim().slice(0, 600) : "",
    };
  }
  return out;
}

// A relevant answer = a non-empty answer not marked "לא רלוונטי". It counts
// for the status even when it is wrong.
export function relevantCount(
  questions: { key: string }[],
  answers: Record<string, string>,
  marks: Marks
): number {
  return questions.filter(
    (q) => (answers[q.key] ?? "").trim() !== "" && marks[q.key]?.mark !== "irrelevant"
  ).length;
}

// 100% relevant → בוצע; 1%–99% → בוצע חלקית; none → לא בוצע. (A task with
// no counted questions at all is trivially complete.)
export function statusFromCounts(relevant: number, total: number): CompletionStatus {
  if (relevant >= total) return "done";
  if (relevant > 0) return "partial";
  return "not_done";
}
