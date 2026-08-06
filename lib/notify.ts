import { db } from "./db";
import { sendEmail } from "./email";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export async function createNotification(opts: {
  userId: number;
  kind: string;
  title: string;
  body?: string;
  link?: string;
}) {
  await db().execute({
    sql: `INSERT INTO notifications (user_id, kind, title, body, link, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [opts.userId, opts.kind, opts.title, opts.body ?? null, opts.link ?? null, now()],
  });
}

export async function teacherIds(): Promise<{ id: number; email: string }[]> {
  const res = await db().execute({
    sql: "SELECT id, email FROM users WHERE role = 'teacher'",
    args: [],
  });
  return res.rows.map((r) => ({ id: Number(r.id), email: String(r.email) }));
}

// Bell + email to every teacher.
export async function notifyTeachers(opts: {
  kind: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const teachers = await teacherIds();
  for (const t of teachers) {
    await createNotification({ userId: t.id, ...opts });
    await sendEmail({
      to: t.email,
      subject: `בינת התורה · ${opts.title}`,
      html: `<div dir="rtl"><p>${opts.title}</p><p>${opts.body ?? ""}</p></div>`,
    });
  }
}

// Bell + email to one student.
export async function notifyStudent(
  userId: number,
  opts: { kind: string; title: string; body?: string; link?: string }
) {
  await createNotification({ userId, ...opts });
  const res = await db().execute({
    sql: "SELECT email FROM users WHERE id = ?",
    args: [userId],
  });
  const email = res.rows[0]?.email as string | undefined;
  if (email) {
    await sendEmail({
      to: email,
      subject: `בינת התורה · ${opts.title}`,
      html: `<div dir="rtl"><p>${opts.title}</p><p>${opts.body ?? ""}</p></div>`,
    });
  }
}

// Overdue sweep — called lazily from dashboard/tasks pages. Creates at most
// one 'overdue' notification per (task, student) for teacher and student.
export async function sweepOverdue() {
  const res = await db().execute({
    sql: `SELECT t.id AS task_id, t.title, t.due_at, a.user_id, u.full_name, u.email
          FROM task_assignments a
          JOIN tasks t ON t.id = a.task_id
          JOIN users u ON u.id = a.user_id
          LEFT JOIN task_progress p ON p.task_id = t.id AND p.user_id = a.user_id
          WHERE t.due_at < ? AND (p.submitted_at IS NULL)`,
    args: [now()],
  });
  for (const r of res.rows) {
    const taskId = Number(r.task_id);
    const userId = Number(r.user_id);
    const marker = `overdue:${taskId}:${userId}`;
    const existing = await db().execute({
      sql: "SELECT 1 FROM notifications WHERE kind = ? LIMIT 1",
      args: [marker],
    });
    if (existing.rows.length > 0) continue;
    const name = (r.full_name as string | null) ?? String(r.email);
    const title = `משימה שעבר זמנה: ${String(r.title)}`;
    // student bell+email
    await notifyStudent(userId, {
      kind: marker,
      title,
      body: "מועד ההגשה עבר והמשימה טרם הוגשה. אפשר עדיין להגיש — כדאי בהקדם.",
      link: `/tasks/${taskId}`,
    });
    // teachers bell+email
    await notifyTeachers({
      kind: marker,
      title: `${name} — ${title}`,
      body: "המשימה לא הוגשה עד המועד האחרון.",
      link: `/dashboard/task/${taskId}`,
    });
  }
}

export async function unreadFor(userId: number, limit = 20) {
  const res = await db().execute({
    sql: `SELECT id, kind, title, body, link, created_at, read_at
          FROM notifications WHERE user_id = ?
          ORDER BY created_at DESC LIMIT ?`,
    args: [userId, limit],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    body: (r.body as string | null) ?? null,
    link: (r.link as string | null) ?? null,
    createdAt: Number(r.created_at),
    read: r.read_at != null,
  }));
}

export async function markAllRead(userId: number) {
  await db().execute({
    sql: "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
    args: [now(), userId],
  });
}
