import { typingStatsFor, EMPTY_TYPING, typedShare } from "@/lib/typing-guard";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/api-auth";
import { getTask, now, focusStatsFor } from "@/lib/tasks";
import { classCheckPicture } from "@/lib/check";
import { effectiveContent } from "@/lib/content-overrides";
import {
  getTaskContent,
  countTaskUnits,
  DECODE_STAGES,
  isWritingTask,
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
  const baseReg = getTaskContent(task.content_ref);
  if (!baseReg) {
    return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  }
  const reg = { ...baseReg, content: await effectiveContent(baseReg.content) };
  const writing = isWritingTask(reg.content);
  const hasCheck = !writing && Boolean(reg.content.check?.length);

  // the equal-weight unit list, in reading order (a writing practice has
  // no decode stages and no check — only its five steps)
  const units: { key: string; label: string; part: "a" | "b" }[] = [];
  if (!writing) {
    for (const s of DECODE_STAGES) {
      units.push({ key: `stage:${s.n}`, label: s.title, part: "a" });
    }
    if (hasCheck) {
      units.push({ key: "check", label: "בדיקת הבנה", part: "a" });
    } else {
      for (const c of reg.content.comprehension) {
        units.push({ key: `comp:${c.key}`, label: "בדיקת הבנה", part: "a" });
      }
    }
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
  // focus picture for the current lesson: the last 90 minutes
  const focus = await focusStatsFor(task.id, t - 90 * 60);
  // how the text came to be (whole task, not windowed): pace flags, blocked pastes
  const typing = await typingStatsFor(task.id);
  // comprehension check: per-student 1-10 + where the class struggles
  const checkPic = hasCheck
    ? await classCheckPicture(task.id)
    : { scores: new Map<number, number>(), average: null, weakSpots: [] };
  const students = roster.rows.map((r) => {
    const uid = Number(r.id);
    const stage = r.stage != null ? Number(r.stage) : 0;
    const submitted = r.submitted_at != null;
    const lastBeat = r.updated_at != null ? Number(r.updated_at) : null;
    const opened = r.opened_at != null;
    const stagesDone = writing ? 0 : Math.min(Math.max(stage - 1, 0), 7);
    const done = answeredBy.get(uid) ?? new Set<string>();
    const checkScore = checkPic.scores.get(uid) ?? null;
    if (checkScore != null) done.add("check");
    const unitsDone = stagesDone + done.size;
    const status = submitted
      ? "submitted"
      : lastBeat != null && t - lastBeat <= ACTIVE_WINDOW
        ? "active"
        : opened
          ? "idle"
          : "absent";
    const f = focus.get(uid) ?? { exits: 0, awayMs: 0, pasteBlocked: 0, copyBlocked: 0 };
    const ty = typing.get(uid) ?? EMPTY_TYPING;
    return {
      id: uid,
      name: (r.full_name as string | null) ?? String(r.email),
      stage,
      unitsDone,
      doneKeys: [...done],
      workSeconds: r.work_seconds != null ? Number(r.work_seconds) : 0,
      lastBeat,
      status,
      focusExits: f.exits,
      focusAwaySec: Math.round(f.awayMs / 1000),
      pasteBlocked: f.pasteBlocked + ty.blockedInserts,
      copyBlocked: f.copyBlocked,
      typingFlag: ty.flagged || ty.rejectedSaves > 0,
      rejectedSaves: ty.rejectedSaves,
      peakCpm: ty.peakCpm,
      typedShare: typedShare(ty),
      checkScore,
    };
  });

  // class focus for the projected board: share of PRESENT students (working
  // now or already submitted this lesson) with at most 2 window exits.
  // Aggregate only — the board never shows per-student focus.
  const present = students.filter(
    (s) => s.status === "active" || s.status === "submitted"
  );
  const classFocusPct =
    present.length === 0
      ? null
      : Math.round(
          (100 * present.filter((s) => s.focusExits <= 2).length) /
            present.length
        );

  return NextResponse.json({
    ok: true,
    now: t,
    classFocusPct,
    // understanding pulse: class average (0-10, one decimal) and the chapter
    // parts sorted hardest-first with the share of wrong answers
    hasCheck,
    classCheckAvg: checkPic.average,
    checkCount: checkPic.scores.size,
    weakSpots: checkPic.weakSpots,
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
