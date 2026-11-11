import { db } from "./db";
import { allStudents, ensureCancellationsTable, now } from "./tasks";
import { ensureGradeAssistColumns, hasFreshProposal } from "./grade-assist";
import { getTaskContent } from "@/content/tasks/registry";
import { isCompletionStatus, type CompletionStatus } from "./completion";

// The teacher's grades report (#24): a row per student, a column per
// published task, each cell the task's completion status.
//   approved — the teacher approved a status (shown in its color)
//   pending  — submitted (or approved under the old numeric grade) and not
//              yet approved; `status` is the proposed one (teacher's draft
//              first, else the automatic proposal), shown in grey
//   missing  — not submitted and the due date has passed
//   open     — assigned, not submitted, still before the due date
//   none     — not assigned and no work
export type ReportCellKind = "approved" | "pending" | "missing" | "open" | "none";
export interface ReportCell {
  kind: ReportCellKind;
  status: CompletionStatus | null;
}
export interface GradesReport {
  tasks: { id: number; title: string; dueAt: number; tag: string | null }[];
  students: { id: number; name: string }[];
  cells: Record<string, ReportCell>; // key `${taskId}:${userId}`
}

export async function buildGradesReport(): Promise<GradesReport> {
  await ensureCancellationsTable();
  await ensureGradeAssistColumns();
  const t = now();
  const taskRes = await db().execute({
    sql: `SELECT id, title, due_at, content_ref FROM tasks t
          WHERE t.published_at <= ?
            AND NOT EXISTS (SELECT 1 FROM task_cancellations c WHERE c.task_id = t.id)
          ORDER BY t.due_at ASC, t.id ASC`,
    args: [t],
  });
  const tasks = taskRes.rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    dueAt: Number(r.due_at),
    // e.g. "בונוס" for the bonus task — marks the column in the report
    tag: getTaskContent(String(r.content_ref))?.content.gradeTag ?? null,
  }));
  const students = (await allStudents()).map((s) => ({ id: s.id, name: s.fullName }));
  const cells: Record<string, ReportCell> = {};
  if (tasks.length === 0 || students.length === 0) return { tasks, students, cells };

  const taskIds = tasks.map((x) => x.id);
  const inTasks = `(${taskIds.map(() => "?").join(", ")})`;
  const [assignRes, progRes, gradeRes] = await Promise.all([
    db().execute({
      sql: `SELECT task_id, user_id FROM task_assignments WHERE task_id IN ${inTasks}`,
      args: taskIds,
    }),
    db().execute({
      sql: `SELECT task_id, user_id, opened_at, submitted_at FROM task_progress WHERE task_id IN ${inTasks}`,
      args: taskIds,
    }),
    db().execute({
      sql: `SELECT task_id, user_id, status, claude_status, claude_submitted_at,
                   approved_at, status_approved_at
            FROM grades WHERE task_id IN ${inTasks}`,
      args: taskIds,
    }),
  ]);
  const key = (taskId: unknown, userId: unknown) => `${Number(taskId)}:${Number(userId)}`;
  const assigned = new Set(assignRes.rows.map((r) => key(r.task_id, r.user_id)));
  const progress = new Map(progRes.rows.map((r) => [key(r.task_id, r.user_id), r]));
  const grades = new Map(gradeRes.rows.map((r) => [key(r.task_id, r.user_id), r]));

  for (const task of tasks) {
    for (const s of students) {
      const k = key(task.id, s.id);
      const p = progress.get(k);
      const g = grades.get(k);
      const submittedAt = p?.submitted_at ?? null;
      if (g?.status_approved_at != null && isCompletionStatus(g.status)) {
        cells[k] = { kind: "approved", status: g.status };
      } else if (submittedAt != null || g?.approved_at != null) {
        const proposed = isCompletionStatus(g?.status)
          ? g.status
          : g &&
              isCompletionStatus(g.claude_status) &&
              hasFreshProposal({
                claude_status: g.claude_status,
                claude_submitted_at: g.claude_submitted_at,
                submitted_at: submittedAt,
              })
            ? g.claude_status
            : null;
        cells[k] = { kind: "pending", status: proposed };
      } else if (assigned.has(k) || p != null) {
        cells[k] = { kind: t > task.dueAt ? "missing" : "open", status: null };
      } else {
        cells[k] = { kind: "none", status: null };
      }
    }
  }
  return { tasks, students, cells };
}
