import { db } from "./db";
import {
  type DocKind,
  type ExamBody,
  type PrepBody,
  emptyExamBody,
  emptyPrepBody,
  parseExamBody,
  parsePrepBody,
} from "./exam-types";
import {
  SEED_EXAM_DURATION,
  SEED_EXAM_TITLE,
  SEED_GUIDE_TITLE,
  SEED_PREP_TITLE,
  seedExamBody,
  seedGuideBody,
  seedPrepBody,
} from "./exam-seed";

// Exams and preparation sheets (issue #25). Server-only. Tables are created
// lazily (canonical DDL: migrations/0017_exams.sql) and the first exam + prep
// sheet are seeded once, as drafts.

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

// a new version row at most every 10 minutes of editing; autosaves in between
// update the newest one
const VERSION_WINDOW = 600;

const DDL = [
  `CREATE TABLE IF NOT EXISTS exam_docs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    duration_min INTEGER,
    body_json TEXT NOT NULL,
    prep_id INTEGER,
    published_at INTEGER,
    opens_at INTEGER,
    seed_key TEXT UNIQUE,
    created_by INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exam_doc_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL REFERENCES exam_docs(id),
    title TEXT NOT NULL,
    duration_min INTEGER,
    body_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS exam_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    started_at INTEGER NOT NULL,
    deadline_at INTEGER NOT NULL,
    submitted_at INTEGER,
    answers_json TEXT NOT NULL DEFAULT '{}',
    claude_points_json TEXT,
    claude_feedback TEXT,
    claude_error TEXT,
    points_json TEXT,
    score REAL,
    feedback TEXT,
    approved_at INTEGER,
    updated_at INTEGER NOT NULL,
    UNIQUE(exam_id, user_id)
  )`,
  "CREATE INDEX IF NOT EXISTS idx_exam_versions_doc ON exam_doc_versions(doc_id)",
  "CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id)",
];

let ready = false;
export async function ensureExamTables() {
  if (ready) return;
  for (const stmt of DDL) await db().execute(stmt);
  // additive column: a general study guide's link to an exam (migration 0018)
  try {
    await db().execute("ALTER TABLE exam_docs ADD COLUMN linked_exam_id INTEGER");
  } catch {
    // already there
  }
  await seedOnce();
  ready = true;
}

async function seedOnce() {
  const t = now();
  const existing = await db().execute(
    "SELECT seed_key, id FROM exam_docs WHERE seed_key IN ('bamidbar-9-14-prep', 'bamidbar-9-14-exam', 'study-guide-how-to-study')"
  );
  const have = new Map(existing.rows.map((r) => [String(r.seed_key), Number(r.id)]));
  let prepId = have.get("bamidbar-9-14-prep");
  if (prepId == null) {
    await db().execute({
      sql: `INSERT OR IGNORE INTO exam_docs (kind, title, body_json, seed_key, created_at, updated_at)
            VALUES ('prep', ?, ?, 'bamidbar-9-14-prep', ?, ?)`,
      args: [SEED_PREP_TITLE, JSON.stringify(seedPrepBody()), t, t],
    });
    const r = await db().execute("SELECT id FROM exam_docs WHERE seed_key = 'bamidbar-9-14-prep'");
    prepId = Number(r.rows[0].id);
  }
  if (!have.has("bamidbar-9-14-exam")) {
    await db().execute({
      sql: `INSERT OR IGNORE INTO exam_docs (kind, title, duration_min, body_json, prep_id, seed_key, created_at, updated_at)
            VALUES ('exam', ?, ?, ?, ?, 'bamidbar-9-14-exam', ?, ?)`,
      args: [SEED_EXAM_TITLE, SEED_EXAM_DURATION, JSON.stringify(seedExamBody()), prepId, t, t],
    });
  }
  // the general "how to study for the exam" sheet (issue #27): a draft,
  // linked by default to the first exam
  if (!have.has("study-guide-how-to-study")) {
    const ex = await db().execute("SELECT id FROM exam_docs WHERE seed_key = 'bamidbar-9-14-exam'");
    const examId = ex.rows[0] ? Number(ex.rows[0].id) : null;
    await db().execute({
      sql: `INSERT OR IGNORE INTO exam_docs (kind, title, body_json, linked_exam_id, seed_key, created_at, updated_at)
            VALUES ('prep', ?, ?, ?, 'study-guide-how-to-study', ?, ?)`,
      args: [SEED_GUIDE_TITLE, JSON.stringify(seedGuideBody()), examId, t, t],
    });
  }
}

export interface DocRow {
  id: number;
  kind: DocKind;
  title: string;
  durationMin: number | null;
  prepId: number | null;
  linkedExamId: number | null; // general guides: the exam they are shown under
  seedKey: string | null;
  publishedAt: number | null;
  opensAt: number | null;
  updatedAt: number;
  bodyJson: string;
}

function toDoc(r: Record<string, unknown>): DocRow {
  return {
    id: Number(r.id),
    kind: r.kind === "prep" ? "prep" : "exam",
    title: String(r.title ?? ""),
    durationMin: r.duration_min == null ? null : Number(r.duration_min),
    prepId: r.prep_id == null ? null : Number(r.prep_id),
    linkedExamId: r.linked_exam_id == null ? null : Number(r.linked_exam_id),
    seedKey: r.seed_key == null ? null : String(r.seed_key),
    publishedAt: r.published_at == null ? null : Number(r.published_at),
    opensAt: r.opens_at == null ? null : Number(r.opens_at),
    updatedAt: Number(r.updated_at),
    bodyJson: String(r.body_json ?? "{}"),
  };
}

export async function listDocs(): Promise<DocRow[]> {
  await ensureExamTables();
  const res = await db().execute("SELECT * FROM exam_docs ORDER BY updated_at DESC");
  return res.rows.map((r) => toDoc(r as Record<string, unknown>));
}

export async function getDoc(id: number): Promise<DocRow | null> {
  await ensureExamTables();
  if (!Number.isInteger(id)) return null;
  const res = await db().execute({ sql: "SELECT * FROM exam_docs WHERE id = ?", args: [id] });
  return res.rows[0] ? toDoc(res.rows[0] as Record<string, unknown>) : null;
}

export function examBodyOf(doc: DocRow): ExamBody {
  return parseExamBody(doc.bodyJson);
}

export function prepBodyOf(doc: DocRow): PrepBody {
  return parsePrepBody(doc.bodyJson);
}

export async function createDoc(kind: DocKind, userId: number, opts?: { title?: string }): Promise<number> {
  await ensureExamTables();
  const t = now();
  const body = kind === "exam" ? emptyExamBody() : emptyPrepBody();
  const res = await db().execute({
    sql: `INSERT INTO exam_docs (kind, title, duration_min, body_json, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [kind, opts?.title ?? "", kind === "exam" ? 90 : null, JSON.stringify(body), userId, t, t],
  });
  return Number(res.lastInsertRowid);
}

// Copy of a document as a new draft. An exam's linked prep sheet is copied
// with it, so the two copies stay a pair.
export async function duplicateDoc(id: number, userId: number): Promise<number | null> {
  const doc = await getDoc(id);
  if (!doc) return null;
  const t = now();
  let prepId: number | null = null;
  if (doc.kind === "exam" && doc.prepId != null) {
    prepId = await duplicateDoc(doc.prepId, userId);
  }
  const res = await db().execute({
    sql: `INSERT INTO exam_docs (kind, title, duration_min, body_json, prep_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [doc.kind, `${doc.title} (עותק)`, doc.durationMin, doc.bodyJson, prepId, userId, t, t],
  });
  return Number(res.lastInsertRowid);
}

export async function saveDoc(
  id: number,
  data: { title: string; durationMin: number | null; bodyJson: string },
  opts?: { forceVersion?: boolean }
) {
  await ensureExamTables();
  const t = now();
  await db().execute({
    sql: "UPDATE exam_docs SET title = ?, duration_min = ?, body_json = ?, updated_at = ? WHERE id = ?",
    args: [data.title, data.durationMin, data.bodyJson, t, id],
  });
  await snapshot(id, data, opts?.forceVersion ?? false);
}

async function snapshot(
  id: number,
  data: { title: string; durationMin: number | null; bodyJson: string },
  force: boolean
) {
  const t = now();
  const last = await db().execute({
    sql: "SELECT id, created_at FROM exam_doc_versions WHERE doc_id = ? ORDER BY id DESC LIMIT 1",
    args: [id],
  });
  const row = last.rows[0];
  if (!force && row && Number(row.created_at) > t - VERSION_WINDOW) {
    await db().execute({
      sql: "UPDATE exam_doc_versions SET title = ?, duration_min = ?, body_json = ?, updated_at = ? WHERE id = ?",
      args: [data.title, data.durationMin, data.bodyJson, t, Number(row.id)],
    });
    return;
  }
  await db().execute({
    sql: `INSERT INTO exam_doc_versions (doc_id, title, duration_min, body_json, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [id, data.title, data.durationMin, data.bodyJson, t, t],
  });
}

export async function listVersions(docId: number) {
  await ensureExamTables();
  const res = await db().execute({
    sql: "SELECT id, title, created_at, updated_at FROM exam_doc_versions WHERE doc_id = ? ORDER BY id DESC LIMIT 60",
    args: [docId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  }));
}

// Restoring keeps the current text as a version of its own first, so a
// restore can itself be undone.
export async function restoreVersion(docId: number, versionId: number) {
  const doc = await getDoc(docId);
  if (!doc) return null;
  const res = await db().execute({
    sql: "SELECT title, duration_min, body_json FROM exam_doc_versions WHERE id = ? AND doc_id = ?",
    args: [versionId, docId],
  });
  const v = res.rows[0];
  if (!v) return null;
  await snapshot(docId, { title: doc.title, durationMin: doc.durationMin, bodyJson: doc.bodyJson }, true);
  const data = {
    title: String(v.title),
    durationMin: v.duration_min == null ? null : Number(v.duration_min),
    bodyJson: String(v.body_json),
  };
  await saveDoc(docId, data, { forceVersion: true });
  return data;
}

export async function setPrepLink(examId: number, prepId: number | null) {
  await db().execute({
    sql: "UPDATE exam_docs SET prep_id = ?, updated_at = ? WHERE id = ? AND kind = 'exam'",
    args: [prepId, now(), examId],
  });
}

export async function setGuideExamLink(prepId: number, examId: number | null) {
  await ensureExamTables();
  await db().execute({
    sql: "UPDATE exam_docs SET linked_exam_id = ?, updated_at = ? WHERE id = ? AND kind = 'prep'",
    args: [examId, now(), prepId],
  });
}

export async function setPublished(id: number, published: boolean, opensAt?: number | null) {
  await ensureExamTables();
  await db().execute({
    sql: "UPDATE exam_docs SET published_at = ?, opens_at = ? WHERE id = ?",
    args: [published ? now() : null, published ? (opensAt ?? null) : null, id],
  });
}

// ── Attempts ────────────────────────────────────────────────────────────

export interface AttemptRow {
  examId: number;
  userId: number;
  startedAt: number;
  deadlineAt: number;
  submittedAt: number | null;
  answers: Record<string, string>;
  claudePoints: Record<string, { points: number; note: string }> | null;
  claudeFeedback: string | null;
  claudeError: string | null;
  points: Record<string, { points: number; note: string }> | null;
  score: number | null;
  feedback: string | null;
  approvedAt: number | null;
  updatedAt: number;
}

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function toAttempt(r: Record<string, unknown>): AttemptRow {
  return {
    examId: Number(r.exam_id),
    userId: Number(r.user_id),
    startedAt: Number(r.started_at),
    deadlineAt: Number(r.deadline_at),
    submittedAt: r.submitted_at == null ? null : Number(r.submitted_at),
    answers: parseJson(r.answers_json, {}),
    claudePoints: parseJson(r.claude_points_json, null),
    claudeFeedback: (r.claude_feedback as string | null) ?? null,
    claudeError: (r.claude_error as string | null) ?? null,
    points: parseJson(r.points_json, null),
    score: r.score == null ? null : Number(r.score),
    feedback: (r.feedback as string | null) ?? null,
    approvedAt: r.approved_at == null ? null : Number(r.approved_at),
    updatedAt: Number(r.updated_at),
  };
}

export async function getAttempt(examId: number, userId: number): Promise<AttemptRow | null> {
  await ensureExamTables();
  const res = await db().execute({
    sql: "SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?",
    args: [examId, userId],
  });
  return res.rows[0] ? toAttempt(res.rows[0] as Record<string, unknown>) : null;
}

export async function attemptsForExam(examId: number) {
  await ensureExamTables();
  const res = await db().execute({
    sql: `SELECT a.*, u.full_name, u.email FROM exam_attempts a JOIN users u ON u.id = a.user_id
          WHERE a.exam_id = ? ORDER BY COALESCE(u.full_name, u.email)`,
    args: [examId],
  });
  return res.rows.map((r) => ({
    ...toAttempt(r as Record<string, unknown>),
    name: (r.full_name as string | null) ?? String(r.email),
  }));
}

export async function attemptCounts(): Promise<Map<number, { total: number; submitted: number; approved: number }>> {
  await ensureExamTables();
  const res = await db().execute(
    `SELECT exam_id, COUNT(*) AS total, SUM(submitted_at IS NOT NULL) AS submitted,
            SUM(approved_at IS NOT NULL) AS approved
     FROM exam_attempts GROUP BY exam_id`
  );
  return new Map(
    res.rows.map((r) => [
      Number(r.exam_id),
      { total: Number(r.total), submitted: Number(r.submitted ?? 0), approved: Number(r.approved ?? 0) },
    ])
  );
}

export async function startAttempt(examId: number, userId: number, durationMin: number): Promise<AttemptRow> {
  const t = now();
  await db().execute({
    sql: `INSERT OR IGNORE INTO exam_attempts (exam_id, user_id, started_at, deadline_at, answers_json, updated_at)
          VALUES (?, ?, ?, ?, '{}', ?)`,
    args: [examId, userId, t, t + Math.max(1, durationMin) * 60, t],
  });
  return (await getAttempt(examId, userId))!;
}

export async function saveAnswers(examId: number, userId: number, answers: Record<string, string>) {
  await db().execute({
    sql: "UPDATE exam_attempts SET answers_json = ?, updated_at = ? WHERE exam_id = ? AND user_id = ? AND submitted_at IS NULL",
    args: [JSON.stringify(answers), now(), examId, userId],
  });
}

export async function submitAttempt(examId: number, userId: number) {
  const t = now();
  await db().execute({
    sql: "UPDATE exam_attempts SET submitted_at = ?, updated_at = ? WHERE exam_id = ? AND user_id = ? AND submitted_at IS NULL",
    args: [t, t, examId, userId],
  });
}

// Published exams and prep sheets a student may see.
export async function publishedDocs(): Promise<DocRow[]> {
  await ensureExamTables();
  const res = await db().execute(
    "SELECT * FROM exam_docs WHERE published_at IS NOT NULL ORDER BY COALESCE(opens_at, published_at) DESC"
  );
  return res.rows.map((r) => toDoc(r as Record<string, unknown>));
}
