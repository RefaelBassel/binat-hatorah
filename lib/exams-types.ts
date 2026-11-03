// Pure types + helpers for the teacher's exams area (no DB, safe on the client).
//
// Two kinds of documents share one table:
//   exam — parts → questions → sub-questions, with points and a teacher-only
//          rubric ("מחוון") per question / sub-question
//   prep — a reading page: headings, paragraphs and lists

export type ExamKind = "exam" | "prep";

export type ExamSub = {
  id: string;
  text: string;
  points: number | null;
  rubric: string; // teacher-only
};

export type ExamQuestion = {
  id: string;
  text: string;
  points: number | null; // for the whole question; empty = sum of sub points
  subs: ExamSub[];
  footer: string; // text shown after the sub-questions
  rubric: string; // teacher-only
};

export type ExamPart = {
  id: string;
  title: string;
  instructions: string;
  points: number | null; // declared total of the part (checked against questions)
  answerCount: number | null; // choice part: answer N of the questions
  questions: ExamQuestion[];
};

export type ExamDoc = {
  durationMin: number | null;
  parts: ExamPart[];
};

export type PrepBlock =
  | { id: string; type: "h"; text: string }
  | { id: string; type: "p"; text: string }
  | { id: string; type: "ul" | "ol"; items: string[] };

export type PrepDoc = { blocks: PrepBlock[] };

export type PrepListBlock = Extract<PrepBlock, { items: string[] }>;
export type PrepTextBlock = Extract<PrepBlock, { text: string }>;
export function isListBlock(b: PrepBlock): b is PrepListBlock {
  return b.type === "ul" || b.type === "ol";
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const EMPTY_EXAM: ExamDoc = { durationMin: null, parts: [] };
export const EMPTY_PREP: PrepDoc = { blocks: [] };

const SUB_LABELS = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "כ", "ל"];
export function subLabel(i: number): string {
  return `${SUB_LABELS[i] ?? String(i + 1)}׳`;
}

function str(v: unknown, max = 20000): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}
function pts(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}
function cnt(v: unknown): number | null {
  const n = pts(v);
  return n === null ? null : Math.round(n);
}
function id(v: unknown): string {
  return typeof v === "string" && v.length > 0 && v.length <= 40 ? v : newId();
}

// Defensive normalisation of whatever JSON arrives from the client or the DB.
export function sanitizeExam(raw: unknown): ExamDoc {
  const r = (raw ?? {}) as Record<string, unknown>;
  const parts = Array.isArray(r.parts) ? r.parts : [];
  return {
    durationMin: cnt(r.durationMin),
    parts: parts.slice(0, 40).map((p) => {
      const pr = (p ?? {}) as Record<string, unknown>;
      const qs = Array.isArray(pr.questions) ? pr.questions : [];
      return {
        id: id(pr.id),
        title: str(pr.title, 500),
        instructions: str(pr.instructions),
        points: pts(pr.points),
        answerCount: cnt(pr.answerCount),
        questions: qs.slice(0, 80).map((q) => {
          const qr = (q ?? {}) as Record<string, unknown>;
          const ss = Array.isArray(qr.subs) ? qr.subs : [];
          return {
            id: id(qr.id),
            text: str(qr.text),
            points: pts(qr.points),
            footer: str(qr.footer),
            rubric: str(qr.rubric),
            subs: ss.slice(0, 24).map((s) => {
              const sr = (s ?? {}) as Record<string, unknown>;
              return {
                id: id(sr.id),
                text: str(sr.text),
                points: pts(sr.points),
                rubric: str(sr.rubric),
              };
            }),
          };
        }),
      };
    }),
  };
}

export function sanitizePrep(raw: unknown): PrepDoc {
  const r = (raw ?? {}) as Record<string, unknown>;
  const blocks = Array.isArray(r.blocks) ? r.blocks : [];
  return {
    blocks: blocks.slice(0, 300).map((b): PrepBlock => {
      const br = (b ?? {}) as Record<string, unknown>;
      if (br.type === "ul" || br.type === "ol") {
        const items = Array.isArray(br.items) ? br.items : [];
        return {
          id: id(br.id),
          type: br.type,
          items: items.slice(0, 100).map((i) => str(i, 4000)),
        };
      }
      return {
        id: id(br.id),
        type: br.type === "h" ? "h" : "p",
        text: str(br.text),
      };
    }),
  };
}

// The student copy: everything except the rubric.
export function stripRubric(doc: ExamDoc): ExamDoc {
  return {
    ...doc,
    parts: doc.parts.map((p) => ({
      ...p,
      questions: p.questions.map((q) => ({
        ...q,
        rubric: "",
        subs: q.subs.map((s) => ({ ...s, rubric: "" })),
      })),
    })),
  };
}

export function questionPoints(q: ExamQuestion): number {
  if (q.points !== null) return q.points;
  return q.subs.reduce((a, s) => a + (s.points ?? 0), 0);
}

// Points the part can give: in a choice part ("answer N of M") only the N
// most valuable questions count.
export function partTotal(p: ExamPart): number {
  const all = p.questions.map(questionPoints).sort((a, b) => b - a);
  const take =
    p.answerCount !== null && p.answerCount > 0 && p.answerCount < all.length
      ? all.slice(0, p.answerCount)
      : all;
  return take.reduce((a, b) => a + b, 0);
}

export function examTotal(doc: ExamDoc): number {
  return Math.round(doc.parts.reduce((a, p) => a + partTotal(p), 0) * 100) / 100;
}

// Parts whose declared points differ from what their questions add up to.
export function partMismatches(doc: ExamDoc): { id: string; declared: number; actual: number }[] {
  const out: { id: string; declared: number; actual: number }[] = [];
  for (const p of doc.parts) {
    if (p.points === null) continue;
    const actual = partTotal(p);
    if (Math.abs(actual - p.points) > 0.001) out.push({ id: p.id, declared: p.points, actual });
  }
  return out;
}

// Gradable units in reading order: a question with sub-questions is graded
// per sub-question, otherwise as one unit. `number` is the running question
// number (1-based, across parts).
export type ExamUnit = {
  key: string; // the answer key (sub id, or question id when no subs)
  questionId: string;
  partId: string;
  number: number;
  label: string; // "3" or "3 א׳"
  max: number | null; // points of this unit when known
  text: string;
  rubric: string;
};

export function examUnits(doc: ExamDoc): ExamUnit[] {
  const units: ExamUnit[] = [];
  let n = 0;
  for (const p of doc.parts) {
    for (const q of p.questions) {
      n++;
      if (q.subs.length === 0) {
        units.push({
          key: q.id,
          questionId: q.id,
          partId: p.id,
          number: n,
          label: String(n),
          max: q.points,
          text: q.text,
          rubric: q.rubric,
        });
      } else {
        q.subs.forEach((s, i) =>
          units.push({
            key: s.id,
            questionId: q.id,
            partId: p.id,
            number: n,
            label: `${n} ${subLabel(i)}`,
            // sub-questions without their own points share the question's
            // points (each is capped by the question total when scoring)
            max: s.points ?? (q.points !== null && q.subs.every((x) => x.points === null) ? q.points : null),
            text: `${q.text}\n${s.text}`.trim(),
            rubric: [q.rubric, s.rubric].filter(Boolean).join("\n"),
          })
        );
      }
    }
  }
  return units;
}

// Total score from per-unit points, honouring choice parts (best N questions)
// and per-question caps.
export function scoreFromUnitPoints(doc: ExamDoc, byKey: Record<string, number>): number {
  let total = 0;
  for (const p of doc.parts) {
    const perQuestion = p.questions.map((q) => {
      const keys = q.subs.length === 0 ? [q.id] : q.subs.map((s) => s.id);
      const raw = keys.reduce((a, k) => a + (Number(byKey[k]) || 0), 0);
      const cap = q.points !== null ? q.points : null;
      return cap !== null ? Math.min(raw, cap) : raw;
    });
    perQuestion.sort((a, b) => b - a);
    const take =
      p.answerCount !== null && p.answerCount > 0 && p.answerCount < perQuestion.length
        ? perQuestion.slice(0, p.answerCount)
        : perQuestion;
    total += take.reduce((a, b) => a + b, 0);
  }
  return Math.round(total * 100) / 100;
}
