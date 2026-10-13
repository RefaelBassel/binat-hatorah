import type { InStatement } from "@libsql/client";
import { db } from "./db";
import { now, ensurePassageShifts, ensureCancellationsTable } from "./tasks";
import { ensureCheckTable } from "./check";
import { getTaskContent, countTaskUnits, isWritingTask } from "@/content/tasks/registry";

// One-time merges of a unit that was published twice (issue #15). The work
// students did in the duplicate (source) task is folded into the task the
// class keeps (target): answers, decode progress and markings, the
// comprehension check, banked questions and work time. Nothing is deleted:
// the source rows stay where they are, so a merge can always be inspected.
// Applied lazily (tracked in _migrations, like ensurePassageShifts) so
// production needs no manual run.
//
// Answer conflicts (teacher's rule): the most recently updated answer
// stays on top; a different, non-empty answer from the other copy is
// appended below it under DUPLICATE_MARK. An empty field takes the other
// copy's answer. A student whose target task is already submitted is
// skipped entirely — submitted work is never changed.
interface TaskMerge {
  name: string;
  contentRef: string;
  sourceTaskId: number;
  targetTaskId: number;
  // restrict to these students (null = every student with work in the source)
  userIds: number[] | null;
  // never touch these students
  excludeUserIds: number[];
}

const MERGES: TaskMerge[] = [
  {
    name: "data:merge-task-11-into-5",
    contentRef: "lesson-05",
    sourceTaskId: 11,
    targetTaskId: 5,
    userIds: [18, 13, 8, 4],
    excludeUserIds: [20],
  },
  {
    name: "data:merge-task-13-into-12",
    contentRef: "e1-grades",
    sourceTaskId: 13,
    targetTaskId: 12,
    userIds: null,
    excludeUserIds: [20],
  },
];

const DUPLICATE_MARK = "(מהעותק הכפול)";

// Single-choice / flag answers ("yes", a picked genre or stance): two values
// cannot be stacked, so the latest one simply wins.
const CHOICE_KEYS = new Set([
  "decode:genre",
  "decode:no-leitwort",
  "decode:q5-added",
  "decode:q5-enough",
  "q-stand:stand",
]);

interface AnswerRow {
  answer: string;
  updatedAt: number;
}

async function answersOf(taskId: number, userId: number) {
  const res = await db().execute({
    sql: "SELECT question_key, answer, updated_at FROM task_answers WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
  const map = new Map<string, AnswerRow>();
  for (const r of res.rows) {
    map.set(String(r.question_key), {
      answer: String(r.answer ?? ""),
      updatedAt: Number(r.updated_at ?? 0),
    });
  }
  return map;
}

// The merged value for one field, or null when the target already holds it.
function mergeAnswer(
  key: string,
  target: AnswerRow | undefined,
  source: AnswerRow
): string | null {
  const s = source.answer;
  const t = target?.answer ?? "";
  if (!s.trim()) return null;
  if (!t.trim()) return s;
  if (s.trim() === t.trim()) return null;
  const sourceIsNewer = source.updatedAt > (target?.updatedAt ?? 0);
  if (CHOICE_KEYS.has(key)) return sourceIsNewer ? s : null;
  const [latest, other] = sourceIsNewer ? [s, t] : [t, s];
  return `${latest}\n\n${DUPLICATE_MARK}\n${other}`;
}

// Same formula as the task page's progress meter (components/task/task-runner.tsx).
function lessonProgressPct(
  contentRef: string,
  stage: number,
  answers: Map<string, string>,
  hasCheckResult: boolean
): number | null {
  const reg = getTaskContent(contentRef);
  if (!reg || isWritingTask(reg.content)) return null;
  let n = Math.min(Math.max(stage - 1, 0), 7);
  if (reg.content.check?.length) {
    if (hasCheckResult) n += 1;
  } else {
    for (const c of reg.content.comprehension) {
      if ((answers.get(`comp:${c.key}`) ?? "").trim().length >= 2) n += 1;
    }
  }
  for (const section of reg.content.sections) {
    for (const block of section.blocks) {
      if (block.type !== "question") continue;
      const keys = block.fields ? block.fields.map((f) => `${block.key}:${f.key}`) : [block.key];
      for (const k of keys) {
        if ((answers.get(k) ?? "").trim().length >= 2) n += 1;
      }
    }
  }
  return Math.min(100, Math.round((n / countTaskUnits(reg)) * 100));
}

async function studentsWithWork(m: TaskMerge): Promise<number[]> {
  const res = await db().execute({
    sql: `SELECT id FROM users WHERE role = 'student' AND id IN (
            SELECT user_id FROM task_progress WHERE task_id = ?
            UNION SELECT user_id FROM task_answers WHERE task_id = ? AND TRIM(answer) <> ''
            UNION SELECT user_id FROM text_markings WHERE task_id = ?
            UNION SELECT user_id FROM check_results WHERE task_id = ?
            UNION SELECT user_id FROM question_bank WHERE task_id = ?)`,
    args: Array(5).fill(m.sourceTaskId),
  });
  return res.rows
    .map((r) => Number(r.id))
    .filter((id) => (m.userIds ? m.userIds.includes(id) : true))
    .filter((id) => !m.excludeUserIds.includes(id));
}

async function statementsForUser(m: TaskMerge, userId: number): Promise<InStatement[] | null> {
  const src = m.sourceTaskId;
  const dst = m.targetTaskId;
  const progress = await db().execute({
    sql: `SELECT task_id, opened_at, work_seconds, progress_pct, stage, submitted_at, updated_at
          FROM task_progress WHERE task_id IN (?, ?) AND user_id = ?`,
    args: [src, dst, userId],
  });
  const sp = progress.rows.find((r) => Number(r.task_id) === src);
  const tp = progress.rows.find((r) => Number(r.task_id) === dst);
  if (tp?.submitted_at != null) return null; // submitted work stays as it is

  const t = now();
  const stmts: InStatement[] = [];

  // answers
  const srcAnswers = await answersOf(src, userId);
  const dstAnswers = await answersOf(dst, userId);
  const merged = new Map<string, string>();
  for (const [k, v] of dstAnswers) merged.set(k, v.answer);
  for (const [key, source] of srcAnswers) {
    const target = dstAnswers.get(key);
    const value = mergeAnswer(key, target, source);
    if (value == null) continue;
    merged.set(key, value);
    // the WHERE keeps a save the student made a moment ago from being overwritten
    stmts.push({
      sql: `INSERT INTO task_answers (task_id, user_id, question_key, answer, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(task_id, user_id, question_key) DO UPDATE SET
              answer = excluded.answer, updated_at = excluded.updated_at
            WHERE task_answers.updated_at = ?`,
      args: [
        dst,
        userId,
        key,
        value,
        Math.max(source.updatedAt, target?.updatedAt ?? 0),
        target ? target.updatedAt : -1,
      ],
    });
  }

  // decode markings (a note fills an empty one; an existing marking is kept)
  stmts.push({
    sql: `INSERT INTO text_markings
            (task_id, user_id, passage_key, word_index, word_text, kind, note, created_at)
          SELECT ?, user_id, passage_key, word_index, word_text, kind, note, created_at
          FROM text_markings WHERE task_id = ? AND user_id = ?
          ON CONFLICT(task_id, user_id, passage_key, word_index, kind)
          DO UPDATE SET note = COALESCE(text_markings.note, excluded.note)`,
    args: [dst, src, userId],
  });

  // comprehension check: one attempt per task — copied only when the target
  // has none (otherwise both attempts remain, each in its own task)
  const checks = await db().execute({
    sql: "SELECT task_id FROM check_results WHERE task_id IN (?, ?) AND user_id = ?",
    args: [src, dst, userId],
  });
  const hasCheck = checks.rows.length > 0;
  stmts.push({
    sql: `INSERT OR IGNORE INTO check_results
            (task_id, user_id, score, correct, total, answers_json, open_answer, submitted_at)
          SELECT ?, user_id, score, correct, total, answers_json, open_answer, submitted_at
          FROM check_results WHERE task_id = ? AND user_id = ?`,
    args: [dst, src, userId],
  });

  // banked questions move to the kept task (skipping ones already there)
  stmts.push({
    sql: `UPDATE question_bank SET task_id = ?
          WHERE task_id = ? AND user_id = ?
            AND TRIM(question) NOT IN (
              SELECT TRIM(question) FROM question_bank WHERE task_id = ? AND user_id = ?)`,
    args: [dst, src, userId, dst, userId],
  });

  // progress: earliest open, furthest stage, both work times added up
  if (sp) {
    const stage = Math.max(Number(sp.stage ?? 1), Number(tp?.stage ?? 1));
    const recomputed = lessonProgressPct(m.contentRef, stage, merged, hasCheck) ?? 0;
    const pct = Math.max(recomputed, Number(sp.progress_pct ?? 0), Number(tp?.progress_pct ?? 0));
    stmts.push({
      sql: `INSERT INTO task_progress
              (task_id, user_id, opened_at, work_seconds, progress_pct, stage, submitted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
            ON CONFLICT(task_id, user_id) DO UPDATE SET
              opened_at = CASE
                WHEN task_progress.opened_at IS NULL THEN excluded.opened_at
                WHEN excluded.opened_at IS NULL THEN task_progress.opened_at
                ELSE MIN(task_progress.opened_at, excluded.opened_at) END,
              work_seconds = task_progress.work_seconds + excluded.work_seconds,
              progress_pct = MAX(task_progress.progress_pct, excluded.progress_pct),
              stage = MAX(task_progress.stage, excluded.stage),
              updated_at = MAX(task_progress.updated_at, excluded.updated_at)`,
      args: [
        dst,
        userId,
        (sp.opened_at as number | null) ?? null,
        Number(sp.work_seconds ?? 0),
        pct,
        stage,
        Math.max(Number(sp.updated_at ?? 0), Number(tp?.updated_at ?? 0)),
      ],
    });
  }

  // the student continues in the kept task only
  stmts.push({
    sql: "INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_at) VALUES (?, ?, ?)",
    args: [dst, userId, t],
  });
  stmts.push({
    sql: "DELETE FROM task_assignments WHERE task_id = ? AND user_id = ?",
    args: [src, userId],
  });
  return stmts;
}

// Before touching anything, every row of both tasks (for the merge's
// students) is exported once as JSON into data_backups (#17), so a merge —
// or anything after it — can always be checked against or restored from it.
// Already-applied merges get a snapshot of the current state.
const BACKUP_TABLES = [
  "task_assignments",
  "task_progress",
  "task_answers",
  "text_markings",
  "check_results",
  "question_bank",
];

async function ensureBackupsTable() {
  await db().execute(
    `CREATE TABLE IF NOT EXISTS data_backups (
       name TEXT PRIMARY KEY,
       created_at INTEGER NOT NULL,
       payload TEXT NOT NULL
     )`
  );
}

async function backupBeforeMerge(m: TaskMerge) {
  const name = `backup:${m.name}`;
  const exists = await db().execute({ sql: "SELECT 1 FROM data_backups WHERE name = ?", args: [name] });
  if (exists.rows.length > 0) return;
  const userFilter = m.userIds ? ` AND user_id IN (${m.userIds.map(() => "?").join(", ")})` : "";
  const payload: Record<string, Record<string, unknown>[]> = {};
  for (const table of BACKUP_TABLES) {
    const res = await db().execute({
      sql: `SELECT * FROM ${table} WHERE task_id IN (?, ?)${userFilter}`,
      args: [m.sourceTaskId, m.targetTaskId, ...(m.userIds ?? [])],
    });
    payload[table] = res.rows.map((r) => Object.fromEntries(res.columns.map((c) => [c, r[c]])));
  }
  await db().execute({
    sql: "INSERT OR IGNORE INTO data_backups (name, created_at, payload) VALUES (?, ?, ?)",
    args: [name, now(), JSON.stringify({ sourceTaskId: m.sourceTaskId, targetTaskId: m.targetTaskId, userIds: m.userIds, rows: payload })],
  });
}

async function runMerge(m: TaskMerge) {
  const tasks = await db().execute({
    sql: "SELECT id, content_ref FROM tasks WHERE id IN (?, ?)",
    args: [m.sourceTaskId, m.targetTaskId],
  });
  const refOk = (id: number) =>
    tasks.rows.some((r) => Number(r.id) === id && String(r.content_ref) === m.contentRef);
  // only the exact duplicate pair described in the issue (e.g. not a fresh DB)
  if (!refOk(m.sourceTaskId) || !refOk(m.targetTaskId)) return;

  const stmts: InStatement[] = [
    { sql: "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)", args: [m.name, now()] },
  ];
  for (const userId of await studentsWithWork(m)) {
    const userStmts = await statementsForUser(m, userId);
    if (userStmts) stmts.push(...userStmts);
  }
  // a duplicate nobody is assigned to stays out of late joiners' lists too
  stmts.push({
    sql: `INSERT OR IGNORE INTO task_cancellations (task_id, cancelled_at)
          SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM task_assignments WHERE task_id = ?)`,
    args: [m.sourceTaskId, now(), m.sourceTaskId],
  });
  // one transaction: a concurrent request fails on the _migrations primary
  // key and rolls back, so each merge happens exactly once
  await db().batch(stmts, "write");
}

let mergesReady = false;
export async function ensureDuplicateTaskMerges() {
  if (mergesReady) return;
  let retryLater = false;
  try {
    // markings are copied as stored: settle the lesson-05 index shift first
    await ensurePassageShifts();
    await ensureCancellationsTable();
    await ensureCheckTable();
    await ensureBackupsTable();
    // no backup, no merge: a failed export leaves that merge for a later request
    const backedUp = new Set<string>();
    for (const m of MERGES) {
      try {
        await backupBeforeMerge(m);
        backedUp.add(m.name);
      } catch (e) {
        console.error(`backup before ${m.name} failed`, e);
      }
    }
    const applied = await db().execute({
      sql: `SELECT name FROM _migrations WHERE name IN (${MERGES.map(() => "?").join(", ")})`,
      args: MERGES.map((m) => m.name),
    });
    const done = new Set(applied.rows.map((r) => String(r.name)));
    for (const m of MERGES) {
      if (done.has(m.name)) continue;
      if (!backedUp.has(m.name)) {
        retryLater = true;
        continue;
      }
      try {
        await runMerge(m);
      } catch (e) {
        const again = await db().execute({
          sql: "SELECT 1 FROM _migrations WHERE name = ?",
          args: [m.name],
        });
        if (again.rows.length === 0) console.error(`task merge ${m.name} failed`, e);
      }
    }
  } catch (e) {
    // never take the tasks pages down over a one-time data fix
    console.error("duplicate task merges failed", e);
  }
  mergesReady = !retryLater;
}
