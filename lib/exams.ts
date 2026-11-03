import { db } from "./db";
import {
  type ExamDoc,
  type ExamKind,
  type PrepDoc,
  sanitizeExam,
  sanitizePrep,
  stripRubric,
  scoreFromUnitPoints,
} from "./exams-types";
import {
  SEED_EXAM_TITLE,
  SEED_PREP_TITLE,
  seedExamDoc,
  seedPrepDoc,
} from "@/content/exams/seed";

// Server side of the exams area. Teacher-only data (`content`, rubric) never
// leaves this file toward students: student reads go through the
// *Published* functions, which return `published_content` (rubric removed).

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// Seconds of grace after the deadline during which a final autosave / submit
// from the student's browser is still accepted (network lag).
const GRACE_SEC = 45;
const MAX_VERSIONS = 60;
const SNAPSHOT_EVERY_SEC = 120;

// ── schema (canonical DDL: migrations/0016_exams.sql) ──────────────────────

let tablesReady = false;
export async function ensureExamTables() {
  if (tablesReady) return;
  const stmts = [
    `CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      published_content TEXT,
      linked_exam_id INTEGER REFERENCES exams(id),
      status TEXT NOT NULL DEFAULT 'draft',
      published_at INTEGER,
      opens_at INTEGER,
      duration_min INTEGER,
      created_by INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS exam_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      label TEXT,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS exam_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL REFERENCES exams(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      started_at INTEGER NOT NULL,
      deadline_at INTEGER NOT NULL,
      submitted_at INTEGER,
      answers TEXT NOT NULL DEFAULT '{}',
      claude_scores TEXT,
      claude_feedback TEXT,
      claude_error TEXT,
      scores TEXT,
      feedback TEXT,
      score REAL,
      approved_at INTEGER,
      updated_at INTEGER NOT NULL,
      UNIQUE(exam_id, user_id)
    )`,
    `CREATE TABLE IF NOT EXISTS exam_meta (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_versions_exam ON exam_versions(exam_id)`,
    `CREATE INDEX IF NOT EXISTS idx_exam_attempts_exam ON exam_attempts(exam_id)`,
  ];
  for (const sql of stmts) await db().execute(sql);
  tablesReady = true;
}

// ── rows ───────────────────────────────────────────────────────────────────

export type ExamRow = {
  id: number;
  kind: ExamKind;
  title: string;
  status: "draft" | "published";
  linkedExamId: number | null;
  publishedAt: number | null;
  opensAt: number | null;
  durationMin: number | null;
  createdAt: number;
  updatedAt: number;
};

type Raw = Record<string, unknown>;

function toRow(r: Raw): ExamRow {
  return {
    id: Number(r.id),
    kind: r.kind === "prep" ? "prep" : "exam",
    title: String(r.title ?? ""),
    status: r.status === "published" ? "published" : "draft",
    linkedExamId: r.linked_exam_id == null ? null : Number(r.linked_exam_id),
    publishedAt: r.published_at == null ? null : Number(r.published_at),
    opensAt: r.opens_at == null ? null : Number(r.opens_at),
    durationMin: r.duration_min == null ? null : Number(r.duration_min),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

const ROW_COLS =
  "id, kind, title, status, linked_exam_id, published_at, opens_at, duration_min, created_at, updated_at";

function parseJson(s: unknown): unknown {
  try {
    return JSON.parse(String(s ?? "null"));
  } catch {
    return null;
  }
}

function docFor(kind: ExamKind, raw: unknown): ExamDoc | PrepDoc {
  return kind === "prep" ? sanitizePrep(raw) : sanitizeExam(raw);
}

// ── seed ───────────────────────────────────────────────────────────────────

// Inserts the first exam + its linked prep sheet once, as drafts. The marker
// row makes it one-shot: deleting them later does not bring them back.
export async function ensureExamSeed(createdBy: number | null) {
  await ensureExamTables();
  const claim = await db().execute({
    sql: "INSERT OR IGNORE INTO exam_meta (key, value) VALUES ('seed_numbers_9_14', ?)",
    args: [String(nowSec())],
  });
  if (claim.rowsAffected !== 1) return;
  const t = nowSec();
  const exam = seedExamDoc();
  const examRes = await db().execute({
    sql: `INSERT INTO exams (kind, title, content, status, duration_min, created_by, created_at, updated_at)
          VALUES ('exam', ?, ?, 'draft', ?, ?, ?, ?)`,
    args: [SEED_EXAM_TITLE, JSON.stringify(exam), exam.durationMin, createdBy, t, t],
  });
  const examId = Number(examRes.lastInsertRowid);
  const prepRes = await db().execute({
    sql: `INSERT INTO exams (kind, title, content, status, linked_exam_id, created_by, created_at, updated_at)
          VALUES ('prep', ?, ?, 'draft', ?, ?, ?, ?)`,
    args: [SEED_PREP_TITLE, JSON.stringify(seedPrepDoc()), examId, createdBy, t, t],
  });
  void prepRes;
}

// ── teacher: list / read / write ───────────────────────────────────────────

export async function listExams(): Promise<ExamRow[]> {
  await ensureExamTables();
  const res = await db().execute(
    `SELECT ${ROW_COLS} FROM exams ORDER BY updated_at DESC, id DESC`
  );
  return res.rows.map((r) => toRow(r as Raw));
}

export async function getExam(
  id: number
): Promise<(ExamRow & { doc: ExamDoc | PrepDoc }) | null> {
  await ensureExamTables();
  const res = await db().execute({
    sql: `SELECT ${ROW_COLS}, content FROM exams WHERE id = ?`,
    args: [id],
  });
  const r = res.rows[0] as Raw | undefined;
  if (!r) return null;
  const row = toRow(r);
  return { ...row, doc: docFor(row.kind, parseJson(r.content)) };
}

export async function createExam(
  kind: ExamKind,
  title: string,
  userId: number,
  linkedExamId: number | null = null
): Promise<number> {
  await ensureExamTables();
  const t = nowSec();
  const doc: ExamDoc | PrepDoc =
    kind === "prep" ? { blocks: [] } : { durationMin: null, parts: [] };
  const res = await db().execute({
    sql: `INSERT INTO exams (kind, title, content, status, linked_exam_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, 'draft', ?, ?, ?, ?)`,
    args: [kind, title.slice(0, 300), JSON.stringify(doc), linkedExamId, userId, t, t],
  });
  return Number(res.lastInsertRowid);
}

// Copies an exam as a new draft; an exam's linked prep sheet is copied too
// and linked to the copy. Nothing is published, rubrics are kept.
export async function duplicateExam(id: number, userId: number): Promise<number | null> {
  const src = await getExam(id);
  if (!src) return null;
  const t = nowSec();
  const copyOne = async (
    s: { kind: ExamKind; title: string; doc: ExamDoc | PrepDoc; durationMin: number | null },
    linked: number | null
  ) => {
    const res = await db().execute({
      sql: `INSERT INTO exams (kind, title, content, status, linked_exam_id, duration_min, created_by, created_at, updated_at)
            VALUES (?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
      args: [
        s.kind,
        `${s.title} (עותק)`.slice(0, 300),
        JSON.stringify(s.doc),
        linked,
        s.durationMin,
        userId,
        t,
        t,
      ],
    });
    return Number(res.lastInsertRowid);
  };
  const newId = await copyOne(src, src.kind === "prep" ? src.linkedExamId : null);
  if (src.kind === "exam") {
    const preps = await db().execute({
      sql: "SELECT id FROM exams WHERE kind = 'prep' AND linked_exam_id = ?",
      args: [id],
    });
    for (const p of preps.rows) {
      const prep = await getExam(Number(p.id));
      if (prep) await copyOne(prep, newId);
    }
  }
  return newId;
}

async function snapshot(examId: number, title: string, content: string, label: string | null) {
  await db().execute({
    sql: "INSERT INTO exam_versions (exam_id, title, content, label, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [examId, title, content, label, nowSec()],
  });
  await db().execute({
    sql: `DELETE FROM exam_versions WHERE exam_id = ? AND id NOT IN
          (SELECT id FROM exam_versions WHERE exam_id = ? ORDER BY id DESC LIMIT ?)`,
    args: [examId, examId, MAX_VERSIONS],
  });
}

// Saves title + document. Before overwriting, the previous state is kept as a
// version (at most one snapshot per SNAPSHOT_EVERY_SEC, so autosave does not
// flood the history). `forceVersion` always snapshots (manual save).
export async function saveExam(
  id: number,
  input: { title: string; doc: unknown; forceVersion?: boolean }
): Promise<{ ok: true; updatedAt: number; doc: ExamDoc | PrepDoc } | { ok: false; error: string }> {
  await ensureExamTables();
  const cur = await db().execute({
    sql: "SELECT kind, title, content FROM exams WHERE id = ?",
    args: [id],
  });
  const r = cur.rows[0] as Raw | undefined;
  if (!r) return { ok: false, error: "הפריט לא נמצא." };
  const kind: ExamKind = r.kind === "prep" ? "prep" : "exam";
  const doc = docFor(kind, input.doc);
  const title = (input.title.trim() || String(r.title)).slice(0, 300);
  const next = JSON.stringify(doc);
  const prevContent = String(r.content);
  const prevTitle = String(r.title);

  if (next !== prevContent || title !== prevTitle) {
    const last = await db().execute({
      sql: "SELECT created_at FROM exam_versions WHERE exam_id = ? ORDER BY id DESC LIMIT 1",
      args: [id],
    });
    const lastAt = last.rows[0] ? Number(last.rows[0].created_at) : 0;
    if (input.forceVersion || nowSec() - lastAt >= SNAPSHOT_EVERY_SEC) {
      await snapshot(id, prevTitle, prevContent, null);
    }
  }
  const t = nowSec();
  const durationMin = kind === "exam" ? (doc as ExamDoc).durationMin : null;
  await db().execute({
    sql: "UPDATE exams SET title = ?, content = ?, duration_min = COALESCE(?, duration_min), updated_at = ? WHERE id = ?",
    args: [title, next, durationMin, t, id],
  });
  return { ok: true, updatedAt: t, doc };
}

export async function deleteExam(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const ex = await getExam(id);
  if (!ex) return { ok: false, error: "הפריט לא נמצא." };
  if (ex.status === "published") {
    return { ok: false, error: "אי אפשר למחוק פריט שפורסם — קודם מבטלים את הפרסום." };
  }
  const attempts = await db().execute({
    sql: "SELECT COUNT(*) AS c FROM exam_attempts WHERE exam_id = ?",
    args: [id],
  });
  if (Number(attempts.rows[0]?.c) > 0) {
    return { ok: false, error: "יש הגשות של תלמידות ותלמידים — אי אפשר למחוק." };
  }
  // a prep sheet linked to a deleted exam stays, unlinked
  await db().execute({
    sql: "UPDATE exams SET linked_exam_id = NULL WHERE linked_exam_id = ?",
    args: [id],
  });
  await db().execute({ sql: "DELETE FROM exam_versions WHERE exam_id = ?", args: [id] });
  await db().execute({ sql: "DELETE FROM exams WHERE id = ?", args: [id] });
  return { ok: true };
}

export async function linkedPreps(examId: number): Promise<ExamRow[]> {
  await ensureExamTables();
  const res = await db().execute({
    sql: `SELECT ${ROW_COLS} FROM exams WHERE kind = 'prep' AND linked_exam_id = ? ORDER BY id`,
    args: [examId],
  });
  return res.rows.map((r) => toRow(r as Raw));
}

// ── versions ───────────────────────────────────────────────────────────────

export type VersionRow = { id: number; title: string; label: string | null; createdAt: number };

export async function listVersions(examId: number): Promise<VersionRow[]> {
  await ensureExamTables();
  const res = await db().execute({
    sql: "SELECT id, title, label, created_at FROM exam_versions WHERE exam_id = ? ORDER BY id DESC",
    args: [examId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    label: (r.label as string | null) ?? null,
    createdAt: Number(r.created_at),
  }));
}

// Restores a version into the live draft. The state being replaced is kept
// as a version first, so a restore itself can be undone.
export async function restoreVersion(
  examId: number,
  versionId: number
): Promise<{ ok: true; title: string; doc: ExamDoc | PrepDoc } | { ok: false; error: string }> {
  const cur = await getExam(examId);
  if (!cur) return { ok: false, error: "הפריט לא נמצא." };
  const v = await db().execute({
    sql: "SELECT title, content FROM exam_versions WHERE id = ? AND exam_id = ?",
    args: [versionId, examId],
  });
  const row = v.rows[0] as Raw | undefined;
  if (!row) return { ok: false, error: "הגרסה לא נמצאה." };
  await snapshot(examId, cur.title, JSON.stringify(cur.doc), "לפני החזרה לגרסה קודמת");
  const doc = docFor(cur.kind, parseJson(row.content));
  const title = String(row.title);
  await db().execute({
    sql: "UPDATE exams SET title = ?, content = ?, duration_min = COALESCE(?, duration_min), updated_at = ? WHERE id = ?",
    args: [
      title,
      JSON.stringify(doc),
      cur.kind === "exam" ? (doc as ExamDoc).durationMin : null,
      nowSec(),
      examId,
    ],
  });
  return { ok: true, title, doc };
}

// ── publishing ─────────────────────────────────────────────────────────────

export async function attemptCount(examId: number): Promise<number> {
  await ensureExamTables();
  const r = await db().execute({
    sql: "SELECT COUNT(*) AS c FROM exam_attempts WHERE exam_id = ?",
    args: [examId],
  });
  return Number(r.rows[0]?.c ?? 0);
}

// Publishes the CURRENT draft as the student copy. For an exam: opening time
// and time limit. Once a student has started, the published copy is frozen
// (only the schedule can still change).
export async function publishExam(
  id: number,
  opts: { opensAt?: number | null; durationMin?: number | null }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ex = await getExam(id);
  if (!ex) return { ok: false, error: "הפריט לא נמצא." };
  const t = nowSec();
  if (ex.kind === "prep") {
    const doc = ex.doc as PrepDoc;
    if (doc.blocks.length === 0) return { ok: false, error: "דף ההכנה ריק — אין מה לפרסם." };
    await snapshot(id, ex.title, JSON.stringify(doc), "בפרסום");
    await db().execute({
      sql: `UPDATE exams SET status = 'published', published_content = ?, published_at = ?, updated_at = ? WHERE id = ?`,
      args: [JSON.stringify(doc), t, t, id],
    });
    return { ok: true };
  }
  const doc = ex.doc as ExamDoc;
  if (doc.parts.every((p) => p.questions.length === 0)) {
    return { ok: false, error: "במבחן אין שאלות — אין מה לפרסם." };
  }
  if (!opts.opensAt || !Number.isFinite(opts.opensAt)) {
    return { ok: false, error: "צריך לבחור תאריך ושעת פתיחה." };
  }
  const duration = opts.durationMin ?? doc.durationMin ?? ex.durationMin;
  if (!duration || duration < 1 || duration > 600) {
    return { ok: false, error: "צריך להגדיר זמן מבחן בדקות (בין 1 ל-600)." };
  }
  const started = await attemptCount(id);
  if (started > 0 && ex.status === "published") {
    // frozen content, schedule only — and not shortened under students' feet
    await db().execute({
      sql: "UPDATE exams SET opens_at = ?, duration_min = ?, updated_at = ? WHERE id = ?",
      args: [opts.opensAt, duration, t, id],
    });
    return { ok: true };
  }
  await snapshot(id, ex.title, JSON.stringify(doc), "בפרסום");
  await db().execute({
    sql: `UPDATE exams SET status = 'published', published_content = ?, published_at = ?,
                 opens_at = ?, duration_min = ?, updated_at = ? WHERE id = ?`,
    args: [JSON.stringify(stripRubric(doc)), t, opts.opensAt, duration, t, id],
  });
  return { ok: true };
}

export async function unpublishExam(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const ex = await getExam(id);
  if (!ex) return { ok: false, error: "הפריט לא נמצא." };
  if (ex.kind === "exam" && (await attemptCount(id)) > 0) {
    return {
      ok: false,
      error: "תלמידות ותלמידים כבר התחילו את המבחן — אי אפשר לבטל את הפרסום (ההגשות נשמרות).",
    };
  }
  await db().execute({
    sql: "UPDATE exams SET status = 'draft', published_content = NULL, updated_at = ? WHERE id = ?",
    args: [nowSec(), id],
  });
  return { ok: true };
}

// ── student side ───────────────────────────────────────────────────────────

export type StudentExamItem = {
  id: number;
  kind: ExamKind;
  title: string;
  opensAt: number | null;
  durationMin: number | null;
  linkedExamId: number | null;
};

export async function listPublishedForStudents(): Promise<StudentExamItem[]> {
  await ensureExamTables();
  const res = await db().execute(
    `SELECT id, kind, title, opens_at, duration_min, linked_exam_id FROM exams
     WHERE status = 'published' ORDER BY COALESCE(opens_at, published_at) DESC, id DESC`
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind === "prep" ? "prep" : "exam",
    title: String(r.title),
    opensAt: r.opens_at == null ? null : Number(r.opens_at),
    durationMin: r.duration_min == null ? null : Number(r.duration_min),
    linkedExamId: r.linked_exam_id == null ? null : Number(r.linked_exam_id),
  }));
}

export async function getPublished(
  id: number,
  kind: ExamKind
): Promise<(StudentExamItem & { doc: ExamDoc | PrepDoc }) | null> {
  await ensureExamTables();
  const res = await db().execute({
    sql: `SELECT id, kind, title, opens_at, duration_min, linked_exam_id, published_content
          FROM exams WHERE id = ? AND kind = ? AND status = 'published'`,
    args: [id, kind],
  });
  const r = res.rows[0] as Raw | undefined;
  if (!r || !r.published_content) return null;
  const doc = docFor(kind, parseJson(r.published_content));
  return {
    id: Number(r.id),
    kind,
    title: String(r.title),
    opensAt: r.opens_at == null ? null : Number(r.opens_at),
    durationMin: r.duration_min == null ? null : Number(r.duration_min),
    linkedExamId: r.linked_exam_id == null ? null : Number(r.linked_exam_id),
    doc,
  };
}

// ── attempts ───────────────────────────────────────────────────────────────

export type AttemptRow = {
  id: number;
  examId: number;
  userId: number;
  startedAt: number;
  deadlineAt: number;
  submittedAt: number | null;
  answers: Record<string, string>;
  claudeScores: Record<string, number> | null;
  claudeFeedback: string | null;
  claudeError: string | null;
  scores: Record<string, number> | null;
  feedback: string | null;
  score: number | null;
  approvedAt: number | null;
};

function parseAnswers(s: unknown): Record<string, string> {
  const o = parseJson(s);
  const out: Record<string, string> = {};
  if (o && typeof o === "object") {
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (typeof v === "string") out[k.slice(0, 60)] = v.slice(0, 30000);
    }
  }
  return out;
}

function parseScores(s: unknown): Record<string, number> | null {
  if (s == null) return null;
  const o = parseJson(s);
  if (!o || typeof o !== "object") return null;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

function toAttempt(r: Raw): AttemptRow {
  return {
    id: Number(r.id),
    examId: Number(r.exam_id),
    userId: Number(r.user_id),
    startedAt: Number(r.started_at),
    deadlineAt: Number(r.deadline_at),
    submittedAt: r.submitted_at == null ? null : Number(r.submitted_at),
    answers: parseAnswers(r.answers),
    claudeScores: parseScores(r.claude_scores),
    claudeFeedback: (r.claude_feedback as string | null) ?? null,
    claudeError: (r.claude_error as string | null) ?? null,
    scores: parseScores(r.scores),
    feedback: (r.feedback as string | null) ?? null,
    score: r.score == null ? null : Number(r.score),
    approvedAt: r.approved_at == null ? null : Number(r.approved_at),
  };
}

// An attempt whose time ran out counts as submitted at its deadline, even if
// the student closed the tab. Done lazily whenever attempts are read.
export async function finalizeExpired(examId?: number) {
  await ensureExamTables();
  const t = nowSec();
  await db().execute({
    sql: `UPDATE exam_attempts SET submitted_at = deadline_at, updated_at = ?
          WHERE submitted_at IS NULL AND deadline_at + ? < ? ${examId ? "AND exam_id = ?" : ""}`,
    args: examId ? [t, GRACE_SEC, t, examId] : [t, GRACE_SEC, t],
  });
}

export async function getAttempt(examId: number, userId: number): Promise<AttemptRow | null> {
  await finalizeExpired(examId);
  const res = await db().execute({
    sql: "SELECT * FROM exam_attempts WHERE exam_id = ? AND user_id = ?",
    args: [examId, userId],
  });
  return res.rows[0] ? toAttempt(res.rows[0] as Raw) : null;
}

export async function getAttemptById(attemptId: number): Promise<AttemptRow | null> {
  await ensureExamTables();
  const res = await db().execute({
    sql: "SELECT * FROM exam_attempts WHERE id = ?",
    args: [attemptId],
  });
  const row = res.rows[0] ? toAttempt(res.rows[0] as Raw) : null;
  if (row && !row.submittedAt) {
    await finalizeExpired(row.examId);
    const again = await db().execute({
      sql: "SELECT * FROM exam_attempts WHERE id = ?",
      args: [attemptId],
    });
    return again.rows[0] ? toAttempt(again.rows[0] as Raw) : row;
  }
  return row;
}

export async function startAttempt(
  examId: number,
  userId: number
): Promise<{ ok: true; attempt: AttemptRow } | { ok: false; error: string }> {
  const ex = await getPublished(examId, "exam");
  if (!ex) return { ok: false, error: "המבחן לא זמין." };
  const t = nowSec();
  if (!ex.opensAt || t < ex.opensAt) return { ok: false, error: "המבחן עדיין לא נפתח." };
  const existing = await getAttempt(examId, userId);
  if (existing) return { ok: true, attempt: existing };
  const duration = ex.durationMin ?? 90;
  await db().execute({
    sql: `INSERT OR IGNORE INTO exam_attempts (exam_id, user_id, started_at, deadline_at, answers, updated_at)
          VALUES (?, ?, ?, ?, '{}', ?)`,
    args: [examId, userId, t, t + duration * 60, t],
  });
  const created = await getAttempt(examId, userId);
  return created ? { ok: true, attempt: created } : { ok: false, error: "לא הצלחנו להתחיל את המבחן." };
}

export async function saveAnswers(
  examId: number,
  userId: number,
  answers: Record<string, string>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const a = await getAttempt(examId, userId);
  if (!a) return { ok: false, error: "המבחן לא התחיל." };
  if (a.submittedAt) return { ok: false, error: "המבחן כבר הוגש." };
  if (nowSec() > a.deadlineAt + GRACE_SEC) return { ok: false, error: "הזמן נגמר." };
  const clean = parseAnswers(JSON.stringify(answers));
  await db().execute({
    sql: "UPDATE exam_attempts SET answers = ?, updated_at = ? WHERE id = ? AND submitted_at IS NULL",
    args: [JSON.stringify(clean), nowSec(), a.id],
  });
  return { ok: true };
}

export async function submitAttempt(
  examId: number,
  userId: number,
  answers: Record<string, string> | null
): Promise<{ ok: true; attemptId: number } | { ok: false; error: string }> {
  const a = await getAttempt(examId, userId);
  if (!a) return { ok: false, error: "המבחן לא התחיל." };
  if (a.submittedAt) return { ok: true, attemptId: a.id };
  const t = nowSec();
  // answers that arrive after deadline + grace are ignored; the saved ones stand
  const accept = answers && t <= a.deadlineAt + GRACE_SEC;
  const finalAnswers = accept ? parseAnswers(JSON.stringify(answers)) : a.answers;
  await db().execute({
    sql: "UPDATE exam_attempts SET answers = ?, submitted_at = ?, updated_at = ? WHERE id = ? AND submitted_at IS NULL",
    args: [JSON.stringify(finalAnswers), Math.min(t, a.deadlineAt), t, a.id],
  });
  return { ok: true, attemptId: a.id };
}

export type AttemptListItem = AttemptRow & { studentName: string };

export async function listAttempts(examId: number): Promise<AttemptListItem[]> {
  await finalizeExpired(examId);
  const res = await db().execute({
    sql: `SELECT a.*, u.full_name, u.email FROM exam_attempts a JOIN users u ON u.id = a.user_id
          WHERE a.exam_id = ? ORDER BY a.submitted_at IS NULL, a.submitted_at DESC, a.id DESC`,
    args: [examId],
  });
  return res.rows.map((r) => ({
    ...toAttempt(r as Raw),
    studentName: ((r.full_name as string | null) ?? String(r.email)) || "",
  }));
}

// ── grading ────────────────────────────────────────────────────────────────

export async function saveClaudeProposal(
  attemptId: number,
  scores: Record<string, number> | null,
  feedback: string | null,
  error: string | null
) {
  await db().execute({
    sql: "UPDATE exam_attempts SET claude_scores = ?, claude_feedback = ?, claude_error = ?, updated_at = ? WHERE id = ?",
    args: [scores ? JSON.stringify(scores) : null, feedback, error, nowSec(), attemptId],
  });
}

// The teacher's numbers: stored as a draft (approve = false) or approved.
export async function saveGrade(
  attemptId: number,
  doc: ExamDoc,
  scoresIn: Record<string, unknown>,
  feedback: string,
  approve: boolean
): Promise<{ ok: true; score: number } | { ok: false; error: string }> {
  const a = await getAttemptById(attemptId);
  if (!a) return { ok: false, error: "ההגשה לא נמצאה." };
  if (!a.submittedAt) return { ok: false, error: "המבחן עוד לא הוגש." };
  const scores: Record<string, number> = {};
  for (const [k, v] of Object.entries(scoresIn)) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && n <= 1000) scores[k.slice(0, 60)] = Math.round(n * 100) / 100;
  }
  const score = scoreFromUnitPoints(doc, scores);
  const t = nowSec();
  await db().execute({
    sql: `UPDATE exam_attempts SET scores = ?, feedback = ?, score = ?, updated_at = ?,
                 approved_at = CASE WHEN ? THEN ? ELSE approved_at END WHERE id = ?`,
    args: [JSON.stringify(scores), feedback.slice(0, 8000), score, t, approve ? 1 : 0, t, attemptId],
  });
  return { ok: true, score };
}
