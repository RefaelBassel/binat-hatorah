import { db } from "./db";

export type StudentTaskStatus =
  | "not_started" // טרם נלמדה (teacher-only label)
  | "in_progress" // בלימוד
  | "overdue" // עבר זמנה
  | "submitted" // הוגשה
  | "graded"; // נלמדה (נבדקה והוזן ציון)

export interface TaskRow {
  id: number;
  content_ref: string;
  title: string;
  published_at: number;
  due_at: number;
}

export interface ProgressRow {
  task_id: number;
  user_id: number;
  opened_at: number | null;
  work_seconds: number;
  progress_pct: number;
  stage: number;
  submitted_at: number | null;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function deriveStatus(
  progress: ProgressRow | null,
  dueAt: number,
  graded: boolean
): StudentTaskStatus {
  if (graded) return "graded";
  if (progress?.submitted_at) return "submitted";
  if (now() > dueAt) return "overdue";
  if (progress?.opened_at) return "in_progress";
  return "not_started";
}

// Hebrew labels + palette color tokens for the color-coded statuses.
export const STATUS_META: Record<
  StudentTaskStatus,
  { label: string; color: string; bg: string }
> = {
  not_started: { label: "טרם נלמדה", color: "#6b6055", bg: "#f0e9e1" },
  in_progress: { label: "בלימוד", color: "#8a6516", bg: "#fdf3d7" },
  overdue: { label: "עבר זמנה", color: "#9d3438", bg: "#f9e5e3" },
  submitted: { label: "הוגשה", color: "#2f5d8a", bg: "#e3edf7" },
  graded: { label: "נלמדה", color: "#3e6b4f", bg: "#e5efe8" },
};

export async function tasksForStudent(userId: number, allPublished = false) {
  // allPublished: teacher in "מצב תלמיד" — sees every published task as if
  // assigned, with her own progress rows.
  const res = await db().execute({
    sql: allPublished
      ? `SELECT t.id, t.content_ref, t.title, t.published_at, t.due_at,
                p.opened_at, p.work_seconds, p.progress_pct, p.stage, p.submitted_at,
                g.score, g.feedback, g.approved_at
         FROM tasks t
         LEFT JOIN task_progress p ON p.task_id = t.id AND p.user_id = ?
         LEFT JOIN grades g ON g.task_id = t.id AND g.user_id = ?
         WHERE t.published_at <= ?
         ORDER BY t.due_at ASC`
      : `SELECT t.id, t.content_ref, t.title, t.published_at, t.due_at,
                p.opened_at, p.work_seconds, p.progress_pct, p.stage, p.submitted_at,
                g.score, g.feedback, g.approved_at
         FROM task_assignments a
         JOIN tasks t ON t.id = a.task_id
         LEFT JOIN task_progress p ON p.task_id = t.id AND p.user_id = a.user_id
         LEFT JOIN grades g ON g.task_id = t.id AND g.user_id = a.user_id
         WHERE a.user_id = ? AND t.published_at <= ?
         ORDER BY t.due_at ASC`,
    args: allPublished ? [userId, userId, now()] : [userId, now()],
  });
  return res.rows.map((r) => {
    const progress: ProgressRow | null = r.opened_at !== null || r.submitted_at !== null
      ? {
          task_id: Number(r.id),
          user_id: userId,
          opened_at: r.opened_at as number | null,
          work_seconds: Number(r.work_seconds ?? 0),
          progress_pct: Number(r.progress_pct ?? 0),
          stage: Number(r.stage ?? 1),
          submitted_at: r.submitted_at as number | null,
        }
      : null;
    const graded = r.approved_at != null;
    return {
      id: Number(r.id),
      contentRef: String(r.content_ref),
      title: String(r.title),
      publishedAt: Number(r.published_at),
      dueAt: Number(r.due_at),
      progressPct: Number(r.progress_pct ?? 0),
      workSeconds: Number(r.work_seconds ?? 0),
      stage: Number(r.stage ?? 1),
      submittedAt: r.submitted_at as number | null,
      score: graded ? Number(r.score) : null,
      feedback: graded ? ((r.feedback as string | null) ?? null) : null,
      status: deriveStatus(progress, Number(r.due_at), graded),
    };
  });
}

// The task the student should continue with: first overdue-unsubmitted, else
// first in-progress, else first not-started — by nearest due date.
export async function continueTask(userId: number, allPublished = false) {
  const list = await tasksForStudent(userId, allPublished);
  return (
    list.find((t) => t.status === "overdue") ??
    list.find((t) => t.status === "in_progress") ??
    list.find((t) => t.status === "not_started") ??
    null
  );
}

export async function getTask(taskId: number): Promise<TaskRow | null> {
  const res = await db().execute({
    sql: "SELECT id, content_ref, title, published_at, due_at FROM tasks WHERE id = ?",
    args: [taskId],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    content_ref: String(r.content_ref),
    title: String(r.title),
    published_at: Number(r.published_at),
    due_at: Number(r.due_at),
  };
}

export async function isAssigned(taskId: number, userId: number) {
  const res = await db().execute({
    sql: "SELECT 1 FROM task_assignments WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  return res.rows.length > 0;
}

export async function ensureProgress(taskId: number, userId: number) {
  const t = now();
  await db().execute({
    sql: `INSERT INTO task_progress (task_id, user_id, opened_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            opened_at = COALESCE(task_progress.opened_at, excluded.opened_at),
            updated_at = excluded.updated_at`,
    args: [taskId, userId, t, t],
  });
}

export async function getProgress(
  taskId: number,
  userId: number
): Promise<ProgressRow | null> {
  const res = await db().execute({
    sql: `SELECT task_id, user_id, opened_at, work_seconds, progress_pct, stage, submitted_at
          FROM task_progress WHERE task_id = ? AND user_id = ?`,
    args: [taskId, userId],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    task_id: Number(r.task_id),
    user_id: Number(r.user_id),
    opened_at: r.opened_at as number | null,
    work_seconds: Number(r.work_seconds),
    progress_pct: Number(r.progress_pct),
    stage: Number(r.stage),
    submitted_at: r.submitted_at as number | null,
  };
}

export async function getAnswers(taskId: number, userId: number) {
  const res = await db().execute({
    sql: "SELECT question_key, answer FROM task_answers WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  const map: Record<string, string> = {};
  for (const r of res.rows) map[String(r.question_key)] = String(r.answer);
  return map;
}

export async function getMarkings(taskId: number, userId: number) {
  const res = await db().execute({
    sql: `SELECT passage_key, word_index, word_text, kind, note
          FROM text_markings WHERE task_id = ? AND user_id = ?`,
    args: [taskId, userId],
  });
  return res.rows.map((r) => ({
    passageKey: String(r.passage_key),
    wordIndex: Number(r.word_index),
    wordText: String(r.word_text),
    kind: String(r.kind),
    note: (r.note as string | null) ?? null,
  }));
}

// ---------- teacher side ----------

export async function allStudents() {
  const res = await db().execute({
    sql: `SELECT id, email, full_name FROM users
          WHERE role = 'student' AND onboarded_at IS NOT NULL
          ORDER BY full_name`,
    args: [],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    fullName: (r.full_name as string | null) ?? String(r.email),
  }));
}

export async function allTasksWithStats() {
  const res = await db().execute({
    sql: `SELECT t.id, t.content_ref, t.title, t.published_at, t.due_at,
            (SELECT COUNT(*) FROM task_assignments a WHERE a.task_id = t.id) AS assigned,
            (SELECT COUNT(*) FROM task_progress p WHERE p.task_id = t.id AND p.submitted_at IS NOT NULL) AS submitted,
            (SELECT COUNT(*) FROM grades g WHERE g.task_id = t.id AND g.approved_at IS NOT NULL) AS graded
          FROM tasks t ORDER BY t.due_at ASC`,
    args: [],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    contentRef: String(r.content_ref),
    title: String(r.title),
    publishedAt: Number(r.published_at),
    dueAt: Number(r.due_at),
    assigned: Number(r.assigned),
    submitted: Number(r.submitted),
    graded: Number(r.graded),
  }));
}

export async function taskRoster(taskId: number) {
  const res = await db().execute({
    sql: `SELECT u.id AS user_id, u.full_name, u.email,
                 p.opened_at, p.work_seconds, p.progress_pct, p.stage, p.submitted_at,
                 g.score, g.claude_score, g.approved_at
          FROM task_assignments a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN task_progress p ON p.task_id = a.task_id AND p.user_id = u.id
          LEFT JOIN grades g ON g.task_id = a.task_id AND g.user_id = u.id
          WHERE a.task_id = ?
          ORDER BY u.full_name`,
    args: [taskId],
  });
  const task = await getTask(taskId);
  return res.rows.map((r) => {
    const progress: ProgressRow | null = r.opened_at !== null || r.submitted_at !== null
      ? {
          task_id: taskId,
          user_id: Number(r.user_id),
          opened_at: r.opened_at as number | null,
          work_seconds: Number(r.work_seconds ?? 0),
          progress_pct: Number(r.progress_pct ?? 0),
          stage: Number(r.stage ?? 1),
          submitted_at: r.submitted_at as number | null,
        }
      : null;
    return {
      userId: Number(r.user_id),
      fullName: (r.full_name as string | null) ?? String(r.email),
      workSeconds: Number(r.work_seconds ?? 0),
      progressPct: Number(r.progress_pct ?? 0),
      submittedAt: r.submitted_at as number | null,
      score: r.score != null ? Number(r.score) : null,
      claudeScore: r.claude_score != null ? Number(r.claude_score) : null,
      status: deriveStatus(progress, task?.due_at ?? 0, r.approved_at != null),
    };
  });
}
