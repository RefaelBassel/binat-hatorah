import { db } from "./db";
import { getDoc, listDocs, now, type DocRow } from "./exams";
import {
  maxLenFor,
  summaryUnitsFor,
  type SummaryField,
  type SummaryUnit,
  type SummaryValues,
} from "./exam-summary-types";
import { ensureCompletionColumns, gradableQuestions, parseMarks, type Marks } from "./completion";

// Students' exam summaries (issue #28). Server-only. The table is created
// lazily (canonical DDL: migrations/0019_exam_summaries.sql). Summaries are
// never graded or checked; only the student and the teachers read them.

const DDL = [
  `CREATE TABLE IF NOT EXISTS exam_summaries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    unit_key TEXT NOT NULL,
    what_happened TEXT NOT NULL DEFAULT '',
    key_verse TEXT NOT NULL DEFAULT '',
    commentator TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    updated_at INTEGER NOT NULL,
    UNIQUE(exam_id, user_id, unit_key)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_exam_summaries_exam ON exam_summaries(exam_id)",
];

let ready = false;
async function ensureSummaryTable() {
  if (ready) return;
  for (const stmt of DDL) await db().execute(stmt);
  ready = true;
}

// column names are fixed here, never taken from the request
const COLUMN: Record<SummaryField, string> = {
  whatHappened: "what_happened",
  keyVerse: "key_verse",
  commentator: "commentator",
  message: "message",
  notes: "notes",
};

// ── Which exam / which units ───────────────────────────────────────────

export interface SummaryContext {
  exam: DocRow;
  units: SummaryUnit[];
}

// The exam a preparation sheet belongs to: the exam it is paired with, or
// the exam a general study guide is linked to.
export async function examForPrep(prep: DocRow): Promise<DocRow | null> {
  const docs = await listDocs();
  const paired = docs.find((d) => d.kind === "exam" && d.prepId === prep.id);
  if (paired) return paired;
  if (prep.linkedExamId != null) return docs.find((d) => d.kind === "exam" && d.id === prep.linkedExamId) ?? null;
  return null;
}

// Summary area of a published prep sheet, or null when its exam covers no units.
export async function summaryContextForPrep(prep: DocRow): Promise<SummaryContext | null> {
  if (prep.kind !== "prep" || prep.publishedAt == null) return null;
  const exam = await examForPrep(prep);
  if (!exam) return null;
  const units = summaryUnitsFor(exam.seedKey);
  return units.length > 0 ? { exam, units } : null;
}

// Summary area of an exam as students see it: only once one of the exam's
// prep sheets (paired or general guide) is published.
export async function summaryContextForExam(examId: number): Promise<SummaryContext | null> {
  const exam = await getDoc(examId);
  if (!exam || exam.kind !== "exam") return null;
  const units = summaryUnitsFor(exam.seedKey);
  if (units.length === 0) return null;
  const docs = await listDocs();
  const published = docs.some(
    (d) => d.kind === "prep" && d.publishedAt != null && (d.id === exam.prepId || d.linkedExamId === exam.id)
  );
  return published ? { exam, units } : null;
}

// Teacher side: units of an exam regardless of publication.
export async function summaryUnitsOfExam(examId: number): Promise<{ exam: DocRow; units: SummaryUnit[] } | null> {
  const exam = await getDoc(examId);
  if (!exam || exam.kind !== "exam") return null;
  const units = summaryUnitsFor(exam.seedKey);
  return units.length > 0 ? { exam, units } : null;
}

// ── Student data ───────────────────────────────────────────────────────

function toValues(r: Record<string, unknown>): SummaryValues {
  return {
    whatHappened: String(r.what_happened ?? ""),
    keyVerse: String(r.key_verse ?? ""),
    commentator: String(r.commentator ?? ""),
    message: String(r.message ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function getSummaries(examId: number, userId: number): Promise<Record<string, SummaryValues>> {
  await ensureSummaryTable();
  const res = await db().execute({
    sql: "SELECT * FROM exam_summaries WHERE exam_id = ? AND user_id = ?",
    args: [examId, userId],
  });
  const out: Record<string, SummaryValues> = {};
  for (const r of res.rows) out[String(r.unit_key)] = toValues(r as Record<string, unknown>);
  return out;
}

// Saves ONE field, so two fields typed in quick succession never overwrite each other.
export async function saveSummaryField(
  examId: number,
  userId: number,
  unitKey: string,
  field: SummaryField,
  value: string
) {
  await ensureSummaryTable();
  const col = COLUMN[field];
  const t = now();
  await db().execute({
    sql: `INSERT INTO exam_summaries (exam_id, user_id, unit_key, ${col}, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(exam_id, user_id, unit_key) DO UPDATE SET ${col} = excluded.${col}, updated_at = excluded.updated_at`,
    args: [examId, userId, unitKey, value.slice(0, maxLenFor(field)), t],
  });
}

export function hasContent(v: SummaryValues): boolean {
  return Object.values(v).some((x) => x.trim() !== "");
}

// ── Teacher data ───────────────────────────────────────────────────────

export interface StudentSummaries {
  userId: number;
  name: string;
  units: Record<string, SummaryValues>;
  updatedAt: number;
}

export async function allSummaries(examId: number): Promise<StudentSummaries[]> {
  await ensureSummaryTable();
  const res = await db().execute({
    sql: `SELECT s.*, u.full_name, u.email FROM exam_summaries s JOIN users u ON u.id = s.user_id
          WHERE s.exam_id = ? AND u.role = 'student' ORDER BY COALESCE(u.full_name, u.email)`,
    args: [examId],
  });
  const byUser = new Map<number, StudentSummaries>();
  for (const r of res.rows) {
    const uid = Number(r.user_id);
    let e = byUser.get(uid);
    if (!e) {
      e = { userId: uid, name: (r.full_name as string | null) ?? String(r.email), units: {}, updatedAt: 0 };
      byUser.set(uid, e);
    }
    const v = toValues(r as Record<string, unknown>);
    if (hasContent(v)) e.units[String(r.unit_key)] = v;
    e.updatedAt = Math.max(e.updatedAt, Number(r.updated_at));
  }
  return [...byUser.values()].filter((e) => Object.keys(e.units).length > 0);
}

// How many students started summarizing, per exam.
export async function summaryStarterCounts(): Promise<Map<number, number>> {
  await ensureSummaryTable();
  const res = await db().execute(
    `SELECT s.exam_id, COUNT(DISTINCT s.user_id) AS n
     FROM exam_summaries s JOIN users u ON u.id = s.user_id
     WHERE u.role = 'student'
       AND (TRIM(s.what_happened) <> '' OR TRIM(s.key_verse) <> '' OR TRIM(s.commentator) <> ''
            OR TRIM(s.message) <> '' OR TRIM(s.notes) <> '')
     GROUP BY s.exam_id`
  );
  return new Map(res.rows.map((r) => [Number(r.exam_id), Number(r.n)]));
}

export async function studentName(userId: number): Promise<string> {
  const res = await db().execute({ sql: "SELECT full_name, email FROM users WHERE id = ?", args: [userId] });
  const r = res.rows[0];
  return r ? ((r.full_name as string | null) ?? String(r.email)) : "";
}

// ── The student's own task answers, by unit ─────────────────────────────

export interface BookletQuestion {
  label: string;
  prompt: string;
  answer: string;
  mark: Marks[string] | null; // only when the teacher approved the feedback
}

export interface BookletUnit {
  unit: SummaryUnit;
  questions: BookletQuestion[];
  hasTask: boolean;
}

export async function taskBooklet(userId: number, units: SummaryUnit[]): Promise<BookletUnit[]> {
  await ensureCompletionColumns();
  const out: BookletUnit[] = [];
  for (const unit of units) {
    const tasks = await db().execute({
      sql: `SELECT t.id FROM tasks t
            WHERE t.content_ref = ?
              AND (EXISTS (SELECT 1 FROM task_assignments a WHERE a.task_id = t.id AND a.user_id = ?)
                   OR EXISTS (SELECT 1 FROM task_progress p WHERE p.task_id = t.id AND p.user_id = ?))
            ORDER BY t.id`,
      args: [unit.taskRef, userId, userId],
    });
    const questions = await gradableQuestions(unit.taskRef);
    const answers: Record<string, string> = {};
    let marks: Marks = {};
    for (const t of tasks.rows) {
      const taskId = Number(t.id);
      const ans = await db().execute({
        sql: "SELECT question_key, answer FROM task_answers WHERE task_id = ? AND user_id = ?",
        args: [taskId, userId],
      });
      for (const r of ans.rows) {
        const a = String(r.answer);
        if (a.trim() !== "" && (answers[String(r.question_key)] ?? "").trim() === "") answers[String(r.question_key)] = a;
      }
      const g = await db().execute({
        sql: "SELECT marks, status_approved_at FROM grades WHERE task_id = ? AND user_id = ?",
        args: [taskId, userId],
      });
      // the teacher's feedback counts only once she approved it
      if (g.rows[0]?.status_approved_at != null) marks = { ...marks, ...parseMarks(g.rows[0].marks) };
    }
    out.push({
      unit,
      hasTask: tasks.rows.length > 0,
      questions: questions
        .filter((q) => (answers[q.key] ?? "").trim() !== "")
        .map((q) => ({ label: q.label, prompt: q.prompt, answer: answers[q.key], mark: marks[q.key] ?? null })),
    });
  }
  return out;
}
