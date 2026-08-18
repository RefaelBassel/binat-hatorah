import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/api-auth";
import { getTask, now } from "@/lib/tasks";
import {
  getTaskContent,
  countTaskUnits,
  DECODE_STAGES,
} from "@/content/tasks/registry";
import type { QuestionBlock } from "@/content/tasks/types";

// Live class status for one task — teacher only. Every question weighs the
// same: 7 decode stages + comprehension answers + every Part-B answer field.
// Presence comes from the work-stopwatch heartbeat (task_progress.updated_at,
// beaten every ~20s while the student's window is visible).
const ACTIVE_WINDOW = 120; // seconds since last heartbeat = "in class, working"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { taskId: raw } = await params;
  const task = await getTask(Number(raw));
  if (!task) {
    return NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 });
  }
  const reg = getTaskContent(task.content_ref);
  if (!reg) {
    return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  }

  // the equal-weight unit list, in reading order
  const units: { key: string; label: string; part: "a" | "b" }[] = [];
  for (const s of DECODE_STAGES) {
    units.push({ key: `stage:${s.n}`, label: s.title, part: "a" });
  }
  for (const c of reg.content.comprehension) {
    units.push({ key: `comp:${c.key}`, label: "בדיקת הבנה", part: "a" });
  }
  for (const sec of reg.content.sections) {
    for (const b of sec.blocks) {
      if (b.type !== "question") continue;
      const q = b as QuestionBlock;
      if (q.fields?.length) {
        for (const f of q.fields) {
          units.push({ key: `${q.key}:${f.key}`, label: q.label, part: "b" });
        }
      } else {
        units.push({ key: q.key, label: q.label, part: "b" });
      }
    }
  }
  const answerKeys = new Set(
    units.filter((u) => !u.key.startsWith("stage:")).map((u) => u.key)
  );

  const roster = await db().execute({
    sql: `SELECT u.id, u.full_name, u.email,
                 p.stage, p.submitted_at, p.updated_at, p.work_seconds, p.opened_at
          FROM task_assignments a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN task_progress p ON p.task_id = a.task_id AND p.user_id = a.user_id
          WHERE a.task_id = ?
          ORDER BY u.full_name`,
    args: [task.id],
  });
  const answers = await db().execute({
    sql: `SELECT user_id, question_key FROM task_answers
          WHERE task_id = ? AND TRIM(answer) <> ''`,
    args: [task.id],
  });
  const answeredBy = new Map<number, Set<string>>();
  for (const r of answers.rows) {
    const uid = Number(r.user_id);
    const key = String(r.question_key);
    if (!answerKeys.has(key)) continue;
    if (!answeredBy.has(uid)) answeredBy.set(uid, new Set());
    answeredBy.get(uid)!.add(key);
  }

  const t = now();
  const students = roster.rows.map((r) => {
    const uid = Number(r.id);
    const stage = r.stage != null ? Number(r.stage) : 0;
    const submitted = r.submitted_at != null;
    const lastBeat = r.updated_at != null ? Number(r.updated_at) : null;
    const opened = r.opened_at != null;
    const stagesDone = Math.min(Math.max(stage - 1, 0), 7);
    const done = answeredBy.get(uid) ?? new Set<string>();
    const unitsDone = stagesDone + done.size;
    const status = submitted
      ? "submitted"
      : lastBeat != null && t - lastBeat <= ACTIVE_WINDOW
        ? "active"
        : opened
          ? "idle"
          : "absent";
    return {
      id: uid,
      name: (r.full_name as string | null) ?? String(r.email),
      stage,
      unitsDone,
      doneKeys: [...done],
      workSeconds: r.work_seconds != null ? Number(r.work_seconds) : 0,
      lastBeat,
      status,
    };
  });

  return NextResponse.json({
    ok: true,
    now: t,
    task: {
      id: task.id,
      title: reg.content.title,
      subtitle: reg.content.subtitle,
      bookRef: reg.content.bookRef,
      dueAt: task.due_at,
    },
    totalUnits: countTaskUnits(reg),
    units,
    students,
  });
}
