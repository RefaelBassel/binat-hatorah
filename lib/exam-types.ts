// Shared (client-safe) shapes and pure helpers for the exams area (issue #25):
// teacher-editable exams and preparation sheets. Server code lives in
// lib/exams.ts.

export type DocKind = "exam" | "prep";

export interface ExamSub {
  id: string;
  text: string;
  points: number | null;
  rubric: string; // teacher-only: sample answer / marking guide
}

export interface ExamQuestion {
  id: string;
  text: string;
  points: number | null; // when null, the sum of the sub-items' points
  rubric: string;
  subs: ExamSub[];
  chooseSubs?: number | null; // "choose N of the sub-items" (e.g. pick one essay topic)
  footer?: string; // text shown after the sub-items
}

export interface ExamPart {
  id: string;
  title: string;
  instructions: string;
  points: number | null; // the points stated for the part (checked against the questions)
  choose: number | null; // "answer N of M" — null = all questions are required
  questions: ExamQuestion[];
}

export interface ExamBody {
  parts: ExamPart[];
}

export type PrepBlockType = "heading" | "text" | "bullets" | "numbered";

export interface PrepBlock {
  id: string;
  type: PrepBlockType;
  text: string; // heading / paragraph text
  items: string[]; // list items
}

export interface PrepBody {
  blocks: PrepBlock[];
}

export const HEB_LETTERS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל", "מ", "נ", "ס", "ע", "פ", "צ", "ק", "ר", "ש", "ת"];

export function subLabel(i: number): string {
  return `${HEB_LETTERS[i] ?? String(i + 1)}.`;
}

export function partLabel(i: number): string {
  return `חלק ${HEB_LETTERS[i] ?? String(i + 1)}׳`;
}

// 10 → "10", 3.3333 → "3.3"
export function fmtPoints(n: number): string {
  return Number.isInteger(n) ? String(n) : (Math.round(n * 10) / 10).toString();
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function emptyExamBody(): ExamBody {
  return {
    parts: [
      {
        id: newId(),
        title: "",
        instructions: "",
        points: null,
        choose: null,
        questions: [{ id: newId(), text: "", points: null, rubric: "", subs: [] }],
      },
    ],
  };
}

export function emptyPrepBody(): PrepBody {
  return { blocks: [{ id: newId(), type: "heading", text: "", items: [] }] };
}

// Points of one question: its own value, or the sum of its sub-items.
export function questionPoints(q: ExamQuestion): number {
  if (q.points != null) return q.points;
  const pts = q.subs.map((x) => x.points ?? 0).sort((a, b) => b - a);
  const n = q.chooseSubs != null && q.chooseSubs > 0 ? Math.min(q.chooseSubs, pts.length) : pts.length;
  return pts.slice(0, n).reduce((s, x) => s + x, 0);
}

// Points a part is worth: all questions, or the N most valuable when the
// students choose N of them.
export function partComputedPoints(p: ExamPart): number {
  const pts = p.questions.map(questionPoints).sort((a, b) => b - a);
  const n = p.choose != null && p.choose > 0 ? Math.min(p.choose, pts.length) : pts.length;
  return pts.slice(0, n).reduce((s, x) => s + x, 0);
}

export function examTotal(body: ExamBody): number {
  return body.parts.reduce((s, p) => s + partComputedPoints(p), 0);
}

// Running question numbers across the whole exam.
export function questionNumbers(body: ExamBody): Map<string, number> {
  const m = new Map<string, number>();
  let n = 1;
  for (const p of body.parts) for (const q of p.questions) m.set(q.id, n++);
  return m;
}

// One answerable item: a question without sub-items, or one sub-item.
export interface AnswerItem {
  key: string; // "qid" or "qid:subid"
  partId: string;
  questionId: string;
  label: string; // e.g. "שאלה 6 סעיף ב."
  prompt: string;
  questionText: string;
  maxPoints: number;
  rubric: string;
}

export function answerItems(body: ExamBody): AnswerItem[] {
  const nums = questionNumbers(body);
  const out: AnswerItem[] = [];
  for (const p of body.parts) {
    for (const q of p.questions) {
      const num = nums.get(q.id) ?? 0;
      if (q.subs.length === 0) {
        out.push({
          key: q.id,
          partId: p.id,
          questionId: q.id,
          label: `שאלה ${num}`,
          prompt: q.text,
          questionText: q.text,
          maxPoints: questionPoints(q),
          rubric: q.rubric,
        });
        continue;
      }
      // sub-items without their own points share the question's points (or,
      // when the student picks N of them, each is worth a 1/N share)
      const chooseSubs = q.chooseSubs != null && q.chooseSubs > 0 ? q.chooseSubs : null;
      const unpointed = q.subs.filter((s) => s.points == null).length;
      const pointed = q.subs.reduce((s, x) => s + (x.points ?? 0), 0);
      const share =
        q.points == null
          ? 0
          : chooseSubs
            ? q.points / chooseSubs
            : unpointed > 0
              ? Math.max(0, q.points - pointed) / unpointed
              : 0;
      q.subs.forEach((s, i) => {
        out.push({
          key: `${q.id}:${s.id}`,
          partId: p.id,
          questionId: q.id,
          label: `שאלה ${num} סעיף ${subLabel(i)}`,
          prompt: s.text,
          questionText: q.text,
          maxPoints: s.points ?? share,
          rubric: [q.rubric, s.rubric].filter(Boolean).join("\n"),
        });
      });
    }
  }
  return out;
}

// Final exam score from per-item points: in a "choose N" part only the N
// best-scoring questions count.
export function scoreFromItems(body: ExamBody, points: Record<string, number>): number {
  let total = 0;
  const items = answerItems(body);
  for (const p of body.parts) {
    const perQ = p.questions.map((q) => {
      const got = items
        .filter((it) => it.questionId === q.id)
        .map((it) => {
          const v = Math.min(it.maxPoints, Math.max(0, points[it.key] ?? 0));
          // 3.3 of a 3.333… share is full marks
          return v >= it.maxPoints - 0.05 ? it.maxPoints : v;
        })
        .sort((a, b) => b - a);
      const n = q.chooseSubs != null && q.chooseSubs > 0 ? Math.min(q.chooseSubs, got.length) : got.length;
      return got.slice(0, n).reduce((s, x) => s + x, 0);
    });
    perQ.sort((a, b) => b - a);
    const n = p.choose != null && p.choose > 0 ? Math.min(p.choose, perQ.length) : perQ.length;
    total += perQ.slice(0, n).reduce((s, x) => s + x, 0);
  }
  return Math.round(total * 10) / 10;
}

// What students may see: no marking guide anywhere.
export function stripRubric(body: ExamBody): ExamBody {
  return {
    parts: body.parts.map((p) => ({
      ...p,
      questions: p.questions.map((q) => ({
        ...q,
        rubric: "",
        subs: q.subs.map((s) => ({ ...s, rubric: "" })),
      })),
    })),
  };
}

export function parseExamBody(raw: unknown): ExamBody {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (v && Array.isArray(v.parts)) return v as ExamBody;
  } catch {}
  return { parts: [] };
}

export function parsePrepBody(raw: unknown): PrepBody {
  try {
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (v && Array.isArray(v.blocks)) return v as PrepBody;
  } catch {}
  return { blocks: [] };
}
