import { db } from "./db";

// How a student sees the Part B worksheet: one question per slide or the
// whole sub-task at once; neither is a default (the task page asks first). Stored per account in users.task_view
// (migrations/0015_user_task_view.sql).
export type TaskView = "slides" | "full";

export function isTaskView(v: unknown): v is TaskView {
  return v === "slides" || v === "full";
}

let columnReady = false;

async function ensureTaskViewColumn() {
  if (columnReady) return;
  const info = await db().execute("PRAGMA table_info(users)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("task_view")) {
    await db().execute("ALTER TABLE users ADD COLUMN task_view TEXT");
  }
  columnReady = true;
}

// null = the student has not chosen yet (neither layout is a hidden default)
export async function getUserTaskView(userId: number): Promise<TaskView | null> {
  try {
    await ensureTaskViewColumn();
    const res = await db().execute({
      sql: "SELECT task_view FROM users WHERE id = ?",
      args: [userId],
    });
    const v = res.rows[0]?.task_view;
    return isTaskView(v) ? v : null;
  } catch {
    return null; // a missing preference must never break the task page
  }
}

export async function setUserTaskView(userId: number, view: TaskView) {
  await ensureTaskViewColumn();
  await db().execute({
    sql: "UPDATE users SET task_view = ? WHERE id = ?",
    args: [view, userId],
  });
}
