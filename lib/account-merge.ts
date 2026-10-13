import type { InStatement, InValue, ResultSet } from "@libsql/client";
import { db } from "./db";
import { ensureApprovalColumns } from "./approval";
import { CHOICE_KEYS } from "./task-merge";

// Merging two Google accounts of one student (issue #19). Some students
// signed in with two different Google accounts and appear twice. The
// teacher picks a primary account; every piece of the secondary account's
// work moves to it, the secondary row stays only as a second sign-in email
// (users.merged_into → primary, resolved in lib/approval.ts resolveAccount).
//
// Nothing is lost: before the merge, every row of both accounts is exported
// into data_backups. Where both accounts hold work in the same task, the
// submitted copy is the main one; in every field answered in both, the main
// (or else the most recent) answer stays on top and the other is appended
// under MARK; an empty field takes the other account's answer.
//
// "הפרדה" (unmerge) restores both accounts from that backup — and keeps
// whatever the student did on the merged account after the merge, on the
// primary account.

const MARK = "(מחשבון נוסף)";

const now = () => Math.floor(Date.now() / 1000);

// Every table that holds per-student rows. ts = the column that tells a row
// written (or updated) after the merge; null = no such column.
interface TableSpec {
  table: string;
  userCols: string[];
  ts: string | null;
}

const TABLES: TableSpec[] = [
  { table: "task_assignments", userCols: ["user_id"], ts: "assigned_at" },
  { table: "task_progress", userCols: ["user_id"], ts: "updated_at" },
  { table: "task_answers", userCols: ["user_id"], ts: "updated_at" },
  { table: "text_markings", userCols: ["user_id"], ts: "created_at" },
  { table: "question_bank", userCols: ["user_id"], ts: "created_at" },
  { table: "check_results", userCols: ["user_id"], ts: "submitted_at" },
  { table: "grades", userCols: ["user_id"], ts: "updated_at" },
  { table: "assist_log", userCols: ["user_id"], ts: "created_at" },
  { table: "reflections", userCols: ["user_id"], ts: "created_at" },
  { table: "writing_results", userCols: ["user_id"], ts: "updated_at" },
  { table: "notifications", userCols: ["user_id"], ts: "created_at" },
  { table: "focus_events", userCols: ["user_id"], ts: "created_at" },
  { table: "typing_events", userCols: ["user_id"], ts: "at" },
  { table: "typing_stats", userCols: ["user_id"], ts: "updated_at" },
  { table: "debate_votes", userCols: ["voter_id"], ts: "created_at" },
  { table: "product_roles", userCols: ["user_id"], ts: "assigned_at" },
  { table: "group_message_reads", userCols: ["user_id"], ts: null },
  { table: "messages", userCols: ["from_user_id", "to_user_id"], ts: "sent_at" },
  { table: "group_messages", userCols: ["from_user_id"], ts: "sent_at" },
];

type Rec = Record<string, InValue>;

interface Snapshot {
  users: Rec[];
  rows: Record<string, Rec[]>;
}

function recs(res: ResultSet): Rec[] {
  return res.rows.map((r) => Object.fromEntries(res.columns.map((c) => [c, r[c] as InValue])));
}

const num = (v: InValue | undefined) => (v == null ? null : Number(v));
const str = (v: InValue | undefined) => (v == null ? "" : String(v));

let tablesReady = false;
async function ensureMergeTables() {
  if (tablesReady) return;
  await ensureApprovalColumns();
  await db().execute(
    `CREATE TABLE IF NOT EXISTS data_backups (
       name TEXT PRIMARY KEY,
       created_at INTEGER NOT NULL,
       payload TEXT NOT NULL
     )`
  );
  await db().execute(
    `CREATE TABLE IF NOT EXISTS account_merges (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       primary_id INTEGER NOT NULL,
       secondary_id INTEGER NOT NULL,
       merged_by INTEGER,
       merged_at INTEGER NOT NULL,
       backup_name TEXT NOT NULL,
       unmerged_at INTEGER,
       unmerge_backup_name TEXT
     )`
  );
  // one active merge per secondary account: a double click cannot merge twice
  await db().execute(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_account_merges_active
       ON account_merges(secondary_id) WHERE unmerged_at IS NULL`
  );
  tablesReady = true;
}

async function existingTables(): Promise<TableSpec[]> {
  const res = await db().execute("SELECT name FROM sqlite_master WHERE type = 'table'");
  const names = new Set(res.rows.map((r) => String(r.name)));
  return TABLES.filter((t) => names.has(t.table));
}

function userFilter(spec: TableSpec, ids: number[]) {
  const ph = ids.map(() => "?").join(", ");
  return {
    where: spec.userCols.map((c) => `${c} IN (${ph})`).join(" OR "),
    args: spec.userCols.flatMap(() => ids),
  };
}

// Every row of both accounts, plus the user rows (and accounts already
// merged into either of them, whose link a merge re-points).
async function snapshot(primaryId: number, secondaryId: number): Promise<Snapshot> {
  const ids = [primaryId, secondaryId];
  const users = await db().execute({
    sql: "SELECT * FROM users WHERE id IN (?, ?) OR merged_into IN (?, ?)",
    args: [...ids, ...ids],
  });
  const rows: Record<string, Rec[]> = {};
  for (const spec of await existingTables()) {
    const f = userFilter(spec, ids);
    const res = await db().execute({ sql: `SELECT * FROM ${spec.table} WHERE ${f.where}`, args: f.args });
    rows[spec.table] = recs(res);
  }
  return { users: recs(users), rows };
}

async function saveBackup(name: string, payload: unknown) {
  await db().execute({
    sql: "INSERT INTO data_backups (name, created_at, payload) VALUES (?, ?, ?)",
    args: [name, now(), JSON.stringify(payload)],
  });
}

interface Ans {
  answer: string;
  updatedAt: number;
}

type Side = "p" | "s";

// The merged value of one field, or null when the primary already holds it.
// main = the side whose copy is the main one (its submission); null = the
// most recent answer goes on top.
function combine(key: string, p: Ans | undefined, s: Ans, main: Side | null): Ans | null {
  const pa = p?.answer ?? "";
  const sa = s.answer;
  if (!sa.trim()) return null;
  if (!pa.trim()) return s;
  if (pa.trim() === sa.trim()) return null;
  const top: Side = main ?? (s.updatedAt > (p?.updatedAt ?? 0) ? "s" : "p");
  const updatedAt = Math.max(s.updatedAt, p?.updatedAt ?? 0);
  if (CHOICE_KEYS.has(key)) return top === "s" ? { answer: sa, updatedAt } : null;
  const [first, second] = top === "s" ? [sa, pa] : [pa, sa];
  return { answer: `${first}\n\n${MARK}\n${second}`, updatedAt };
}

// Writing-practice answers are a JSON object of fields: merged field by field.
function combineJson(winner: string, loser: string): string {
  try {
    const w = JSON.parse(winner) as Record<string, unknown>;
    const l = JSON.parse(loser) as Record<string, unknown>;
    if (!w || !l || typeof w !== "object" || typeof l !== "object") return winner;
    const out: Record<string, unknown> = { ...w };
    for (const [k, v] of Object.entries(l)) {
      if (typeof v !== "string") {
        if (!(k in out)) out[k] = v;
        continue;
      }
      const cur = typeof out[k] === "string" ? (out[k] as string) : "";
      const merged = combine(k, { answer: cur, updatedAt: 1 }, { answer: v, updatedAt: 0 }, "p");
      if (merged) out[k] = merged.answer;
    }
    return JSON.stringify(out);
  } catch {
    return winner;
  }
}

function byKey(rows: Rec[], userCol: string, userId: number, key: (r: Rec) => string) {
  const map = new Map<string, Rec>();
  for (const r of rows) if (num(r[userCol]) === userId) map.set(key(r), r);
  return map;
}

// The statements that fold the secondary account into the primary one,
// computed from the snapshot taken (and backed up) a moment before, at
// snapAt.
function mergeStatements(snap: Snapshot, p: number, s: number, snapAt: number): InStatement[] {
  const stmts: InStatement[] = [];
  const rows = (t: string) => snap.rows[t] ?? [];

  // which account's copy of a task is the main one: the submitted copy
  const progP = byKey(rows("task_progress"), "user_id", p, (r) => str(r.task_id));
  const progS = byKey(rows("task_progress"), "user_id", s, (r) => str(r.task_id));
  const mainSide = (taskId: string): Side | null => {
    const a = num(progP.get(taskId)?.submitted_at);
    const b = num(progS.get(taskId)?.submitted_at);
    if (a != null && b != null) return b > a ? "s" : "p";
    if (b != null) return "s";
    if (a != null) return "p";
    return null;
  };

  // progress: earliest open, both work times added, furthest stage and
  // progress, the main copy's submission
  for (const [taskId, sp] of progS) {
    const pp = progP.get(taskId);
    if (!pp) continue;
    const opened = [num(pp.opened_at), num(sp.opened_at)].filter((v): v is number => v != null);
    const main = mainSide(taskId);
    stmts.push({
      sql: `UPDATE task_progress SET opened_at = ?, work_seconds = ?, progress_pct = ?, stage = ?,
              submitted_at = ?, updated_at = ? WHERE task_id = ? AND user_id = ?`,
      args: [
        opened.length ? Math.min(...opened) : null,
        (num(pp.work_seconds) ?? 0) + (num(sp.work_seconds) ?? 0),
        Math.max(num(pp.progress_pct) ?? 0, num(sp.progress_pct) ?? 0),
        Math.max(num(pp.stage) ?? 1, num(sp.stage) ?? 1),
        main === "s" ? sp.submitted_at : main === "p" ? pp.submitted_at : null,
        Math.max(num(pp.updated_at) ?? 0, num(sp.updated_at) ?? 0),
        Number(taskId),
        p,
      ],
    });
  }

  // answers
  const ansKey = (r: Rec) => `${str(r.task_id)}|${str(r.question_key)}`;
  const ansP = byKey(rows("task_answers"), "user_id", p, ansKey);
  for (const [k, sr] of byKey(rows("task_answers"), "user_id", s, ansKey)) {
    const pr = ansP.get(k);
    if (!pr) continue;
    const toAns = (r: Rec): Ans => ({ answer: str(r.answer), updatedAt: num(r.updated_at) ?? 0 });
    const merged = combine(str(sr.question_key), toAns(pr), toAns(sr), mainSide(str(sr.task_id)));
    if (!merged) continue;
    stmts.push({
      sql: "UPDATE task_answers SET answer = ?, updated_at = ? WHERE task_id = ? AND user_id = ? AND question_key = ?",
      args: [merged.answer, merged.updatedAt, sr.task_id, p, sr.question_key],
    });
  }

  // decode markings: the same word marked in both keeps both notes
  const markKey = (r: Rec) => `${str(r.task_id)}|${str(r.passage_key)}|${str(r.word_index)}|${str(r.kind)}`;
  const markP = byKey(rows("text_markings"), "user_id", p, markKey);
  for (const [k, sr] of byKey(rows("text_markings"), "user_id", s, markKey)) {
    const pr = markP.get(k);
    const sn = str(sr.note).trim();
    if (!pr || !sn) continue;
    const pn = str(pr.note).trim();
    if (pn === sn) continue;
    stmts.push({
      sql: "UPDATE text_markings SET note = ? WHERE id = ?",
      args: [pn ? `${pn}\n${MARK} ${sn}` : sn, pr.id],
    });
  }

  // comprehension check (one attempt per task): the main copy's attempt
  // stays, the other open answer is appended to it
  const checkP = byKey(rows("check_results"), "user_id", p, (r) => str(r.task_id));
  for (const [taskId, sr] of byKey(rows("check_results"), "user_id", s, (r) => str(r.task_id))) {
    const pr = checkP.get(taskId);
    if (!pr) continue;
    const winner: Side =
      mainSide(taskId) ?? ((num(sr.submitted_at) ?? 0) > (num(pr.submitted_at) ?? 0) ? "s" : "p");
    const [w, l] = winner === "s" ? [sr, pr] : [pr, sr];
    const wo = str(w.open_answer).trim();
    const lo = str(l.open_answer).trim();
    const open = !lo || lo === wo ? (w.open_answer ?? null) : wo ? `${wo}\n\n${MARK}\n${lo}` : lo;
    stmts.push({
      sql: "UPDATE check_results SET open_answer = ? WHERE task_id = ? AND user_id = ?",
      args: [open, Number(taskId), winner === "s" ? s : p],
    });
    if (winner === "s") {
      stmts.push({ sql: "DELETE FROM check_results WHERE task_id = ? AND user_id = ?", args: [Number(taskId), p] });
    }
  }

  // grades follow the main submission; otherwise an approved grade, then
  // the most recent one
  const gradeP = byKey(rows("grades"), "user_id", p, (r) => str(r.task_id));
  for (const [taskId, sr] of byKey(rows("grades"), "user_id", s, (r) => str(r.task_id))) {
    const pr = gradeP.get(taskId);
    if (!pr) continue;
    const meaningful = (g: Rec) => g.approved_at != null || g.score != null || g.claude_score != null;
    const main = mainSide(taskId);
    let winner: Side;
    if (main && meaningful(main === "s" ? sr : pr)) winner = main;
    else if ((sr.approved_at != null) !== (pr.approved_at != null)) winner = sr.approved_at != null ? "s" : "p";
    else winner = (num(sr.updated_at) ?? 0) > (num(pr.updated_at) ?? 0) ? "s" : "p";
    if (winner === "s") {
      stmts.push({ sql: "DELETE FROM grades WHERE task_id = ? AND user_id = ?", args: [Number(taskId), p] });
    }
  }

  // writing practice: the latest attempt on top, the best score kept
  const writeP = byKey(rows("writing_results"), "user_id", p, (r) => str(r.exercise_key));
  for (const [ex, sr] of byKey(rows("writing_results"), "user_id", s, (r) => str(r.exercise_key))) {
    const pr = writeP.get(ex);
    if (!pr) continue;
    const winner: Side = (num(sr.updated_at) ?? 0) > (num(pr.updated_at) ?? 0) ? "s" : "p";
    const [w, l] = winner === "s" ? [sr, pr] : [pr, sr];
    const scores = [num(w.score), num(l.score)].filter((v): v is number => v != null);
    stmts.push({
      sql: "UPDATE writing_results SET score = ?, answers = ? WHERE user_id = ? AND exercise_key = ?",
      args: [
        scores.length ? Math.max(...scores) : null,
        combineJson(str(w.answers), str(l.answers)),
        winner === "s" ? s : p,
        ex,
      ],
    });
    if (winner === "s") {
      stmts.push({ sql: "DELETE FROM writing_results WHERE user_id = ? AND exercise_key = ?", args: [p, ex] });
    }
  }

  // typing counters add up
  const typeP = byKey(rows("typing_stats"), "user_id", p, (r) => str(r.task_id));
  for (const [taskId, sr] of byKey(rows("typing_stats"), "user_id", s, (r) => str(r.task_id))) {
    const pr = typeP.get(taskId);
    if (!pr) continue;
    const sum = (c: string) => (num(pr[c]) ?? 0) + (num(sr[c]) ?? 0);
    const max = (c: string) => Math.max(num(pr[c]) ?? 0, num(sr[c]) ?? 0);
    stmts.push({
      sql: `UPDATE typing_stats SET typed_chars = ?, bulk_chars = ?, allowed_chars = ?,
              blocked_inserts = ?, rejected_saves = ?, peak_cpm = ?, flagged = ?, updated_at = ?
            WHERE task_id = ? AND user_id = ?`,
      args: [
        sum("typed_chars"),
        sum("bulk_chars"),
        sum("allowed_chars"),
        sum("blocked_inserts"),
        sum("rejected_saves"),
        max("peak_cpm"),
        max("flagged"),
        max("updated_at"),
        Number(taskId),
        p,
      ],
    });
  }

  // group chat: read up to the further point
  const readP = byKey(rows("group_message_reads"), "user_id", p, (r) => str(r.group_id));
  for (const [g, sr] of byKey(rows("group_message_reads"), "user_id", s, (r) => str(r.group_id))) {
    const pr = readP.get(g);
    if (!pr) continue;
    stmts.push({
      sql: "UPDATE group_message_reads SET last_read_message_id = ? WHERE group_id = ? AND user_id = ?",
      args: [Math.max(num(pr.last_read_message_id) ?? 0, num(sr.last_read_message_id) ?? 0), g, p],
    });
  }

  // everything else moves as is; rows that collide with a primary row were
  // folded into it above (and are in the backup), so the leftovers go —
  // except a row saved after the snapshot, which stays (not in the backup)
  for (const table of Object.keys(snap.rows)) {
    const spec = TABLES.find((t) => t.table === table)!;
    for (const c of spec.userCols) {
      stmts.push({ sql: `UPDATE OR IGNORE ${table} SET ${c} = ? WHERE ${c} = ?`, args: [p, s] });
      stmts.push(
        spec.ts
          ? {
              sql: `DELETE FROM ${table} WHERE ${c} = ? AND (${spec.ts} IS NULL OR ${spec.ts} <= ?)`,
              args: [s, snapAt],
            }
          : { sql: `DELETE FROM ${table} WHERE ${c} = ?`, args: [s] }
      );
    }
  }
  return stmts;
}

export interface MergeResult {
  ok: boolean;
  error?: string;
}

export async function mergeAccounts(opts: {
  primaryId: number;
  secondaryId: number;
  fullName: string;
  teacherId: number;
}): Promise<MergeResult> {
  const { primaryId: p, secondaryId: s } = opts;
  const fullName = opts.fullName.trim();
  if (!Number.isInteger(p) || !Number.isInteger(s) || p === s) return { ok: false, error: "יש לבחור שני חשבונות שונים." };
  if (!fullName) return { ok: false, error: "יש לבחור שם להצגה." };
  await ensureMergeTables();
  const users = await db().execute({
    sql: "SELECT id, role, merged_into FROM users WHERE id IN (?, ?)",
    args: [p, s],
  });
  if (users.rows.length !== 2) return { ok: false, error: "אחד החשבונות לא נמצא." };
  if (users.rows.some((r) => r.role !== "student")) return { ok: false, error: "אי אפשר לאחד חשבון של מורה." };
  if (users.rows.some((r) => r.merged_into != null)) return { ok: false, error: "אחד החשבונות כבר אוחד לחשבון אחר." };

  // no backup, no merge
  const t = now();
  const snap = await snapshot(p, s);
  const backupName = `backup:account-merge:${p}+${s}:${t}`;
  await saveBackup(backupName, { primaryId: p, secondaryId: s, ...snap });

  const stmts = mergeStatements(snap, p, s, t);
  stmts.push(
    {
      sql: `UPDATE users SET full_name = ?,
              approved_at = COALESCE(approved_at, (SELECT approved_at FROM users WHERE id = ?)),
              onboarded_at = COALESCE(onboarded_at, (SELECT onboarded_at FROM users WHERE id = ?)),
              address_form = COALESCE(address_form, (SELECT address_form FROM users WHERE id = ?)),
              last_seen_at = MAX(COALESCE(last_seen_at, 0), COALESCE((SELECT last_seen_at FROM users WHERE id = ?), 0))
            WHERE id = ?`,
      args: [fullName, s, s, s, s, p],
    },
    // emails merged earlier into the secondary now sign in to the primary too
    { sql: "UPDATE users SET merged_into = ? WHERE merged_into = ?", args: [p, s] },
    { sql: "UPDATE users SET merged_into = ? WHERE id = ?", args: [p, s] },
    {
      sql: `INSERT INTO account_merges (primary_id, secondary_id, merged_by, merged_at, backup_name)
            VALUES (?, ?, ?, ?, ?)`,
      args: [p, s, opts.teacherId, t, backupName],
    }
  );
  try {
    // one transaction: all of it, or nothing
    await db().batch(stmts, "write");
  } catch (e) {
    console.error("account merge failed", e);
    return { ok: false, error: "האיחוד לא הושלם (לא שונה דבר) — נסי שוב." };
  }
  return { ok: true };
}

function insertStatements(table: string, rows: Rec[]): InStatement[] {
  const out: InStatement[] = [];
  const groups = new Map<string, Rec[]>();
  for (const r of rows) {
    const cols = Object.keys(r).join(",");
    groups.set(cols, [...(groups.get(cols) ?? []), r]);
  }
  for (const [colList, group] of groups) {
    const cols = colList.split(",");
    for (let i = 0; i < group.length; i += 40) {
      const chunk = group.slice(i, i + 40);
      out.push({
        sql: `INSERT OR REPLACE INTO ${table} (${cols.map((c) => `"${c}"`).join(", ")}) VALUES ${chunk
          .map(() => `(${cols.map(() => "?").join(", ")})`)
          .join(", ")}`,
        args: chunk.flatMap((r) => cols.map((c) => r[c] ?? null)),
      });
    }
  }
  return out;
}

// A merge can be undone while no later merge builds on its primary account
// (those are separated first, newest first).
async function blockingMerge(mergeId: number, primaryId: number) {
  const res = await db().execute({
    sql: `SELECT 1 FROM account_merges
          WHERE unmerged_at IS NULL AND id > ? AND (primary_id = ? OR secondary_id = ?)`,
    args: [mergeId, primaryId, primaryId],
  });
  return res.rows.length > 0;
}

export async function unmergeAccounts(mergeId: number): Promise<MergeResult> {
  await ensureMergeTables();
  const m = await db().execute({
    sql: "SELECT primary_id, secondary_id, merged_at, backup_name FROM account_merges WHERE id = ? AND unmerged_at IS NULL",
    args: [mergeId],
  });
  const row = m.rows[0];
  if (!row) return { ok: false, error: "האיחוד הזה כבר הופרד." };
  const p = Number(row.primary_id);
  const s = Number(row.secondary_id);
  const mergedAt = Number(row.merged_at);
  if (await blockingMerge(mergeId, p)) {
    return { ok: false, error: "יש איחוד מאוחר יותר לחשבון הזה — יש להפריד אותו קודם." };
  }
  const b = await db().execute({ sql: "SELECT payload FROM data_backups WHERE name = ?", args: [String(row.backup_name)] });
  if (!b.rows[0]) return { ok: false, error: "הגיבוי של האיחוד לא נמצא — לא שונה דבר." };
  const before = JSON.parse(String(b.rows[0].payload)) as Snapshot;

  // the merged state is backed up too, so a separation can be checked later
  const t = now();
  const current = await snapshot(p, s);
  const backupName = `backup:account-unmerge:${mergeId}:${t}`;
  await saveBackup(backupName, { mergeId, primaryId: p, secondaryId: s, ...current });

  const stmts: InStatement[] = [];
  const laterTasks = new Set<number>();
  for (const [table, rows] of Object.entries(before.rows)) {
    const spec = TABLES.find((x) => x.table === table);
    if (!spec || !current.rows[table]) continue;
    const f = userFilter(spec, [p, s]);
    stmts.push({ sql: `DELETE FROM ${table} WHERE ${f.where}`, args: f.args });
    stmts.push(...insertStatements(table, rows));
    // work saved after the merge stays where it was written (the primary)
    if (spec.ts) {
      const ts = spec.ts;
      const later = current.rows[table]
        .filter((r) => (num(r[ts]) ?? 0) > mergedAt)
        .map((r) => Object.fromEntries(Object.entries(r).filter(([c]) => c !== "id")));
      stmts.push(...insertStatements(table, later));
      if (table === "task_answers" || table === "task_progress") {
        for (const r of later) if (num(r.user_id) === p) laterTasks.add(Number(r.task_id));
      }
    }
  }
  // a task worked on after the merge stays in the primary account's list
  // (if it is still assigned there now — a cancelled task stays cancelled)
  const assignedNow = new Set(
    (current.rows.task_assignments ?? []).filter((r) => num(r.user_id) === p).map((r) => Number(r.task_id))
  );
  for (const taskId of [...laterTasks].filter((id) => assignedNow.has(id))) {
    stmts.push({
      sql: "INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_at) VALUES (?, ?, ?)",
      args: [taskId, p, t],
    });
  }
  for (const u of before.users) {
    stmts.push({
      sql: "UPDATE users SET full_name = ?, merged_into = ?, approved_at = ?, onboarded_at = ?, address_form = ? WHERE id = ?",
      args: [u.full_name ?? null, u.merged_into ?? null, u.approved_at ?? null, u.onboarded_at ?? null, u.address_form ?? null, u.id],
    });
  }
  stmts.push({
    sql: "UPDATE account_merges SET unmerged_at = ?, unmerge_backup_name = ? WHERE id = ?",
    args: [t, backupName, mergeId],
  });
  try {
    await db().batch(stmts, "write");
  } catch (e) {
    console.error("account unmerge failed", e);
    return { ok: false, error: "ההפרדה לא הושלמה (לא שונה דבר) — נסי שוב." };
  }
  return { ok: true };
}

export interface ActiveMerge {
  id: number;
  primaryId: number;
  secondaryEmail: string;
  mergedAt: number;
  canUndo: boolean;
}

export async function listActiveMerges(): Promise<ActiveMerge[]> {
  await ensureMergeTables();
  const res = await db().execute(
    `SELECT m.id, m.primary_id, m.merged_at, u.email,
            NOT EXISTS (SELECT 1 FROM account_merges l
                        WHERE l.unmerged_at IS NULL AND l.id > m.id
                          AND (l.primary_id = m.primary_id OR l.secondary_id = m.primary_id)) AS can_undo
     FROM account_merges m JOIN users u ON u.id = m.secondary_id
     WHERE m.unmerged_at IS NULL
     ORDER BY m.id`
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    primaryId: Number(r.primary_id),
    secondaryEmail: String(r.email),
    mergedAt: Number(r.merged_at),
    canUndo: Boolean(Number(r.can_undo)),
  }));
}

// ---------- the confirmation screen ----------

export interface MergeSideTask {
  taskId: number;
  title: string;
  state: string;
  progressPct: number;
  submitted: boolean;
  answers: number;
  grade: string | null;
}

export interface MergeSide {
  id: number;
  email: string;
  emails: string[];
  fullName: string | null;
  lastSeenAt: number | null;
  role: string;
  mergedInto: number | null;
  tasks: MergeSideTask[];
  writing: number;
  messages: number;
  questions: number;
}

export async function mergeSide(userId: number): Promise<MergeSide | null> {
  await ensureApprovalColumns();
  const u = await db().execute({
    sql: `SELECT id, email, full_name, role, merged_into,
                 MAX(COALESCE(last_seen_at, 0),
                     COALESCE((SELECT MAX(m.last_seen_at) FROM users m WHERE m.merged_into = users.id), 0)) AS seen,
                 (SELECT GROUP_CONCAT(m.email, ' ') FROM users m WHERE m.merged_into = users.id) AS linked
          FROM users WHERE id = ?`,
    args: [userId],
  });
  const r = u.rows[0];
  if (!r) return null;
  const tasks = await db().execute({
    sql: `SELECT t.id, t.title,
                 EXISTS(SELECT 1 FROM task_assignments a WHERE a.task_id = t.id AND a.user_id = ?) AS assigned,
                 p.opened_at, p.progress_pct, p.submitted_at,
                 g.score, g.claude_score, g.approved_at,
                 (SELECT COUNT(*) FROM task_answers x
                    WHERE x.task_id = t.id AND x.user_id = ? AND TRIM(x.answer) <> '') AS answers
          FROM tasks t
          LEFT JOIN task_progress p ON p.task_id = t.id AND p.user_id = ?
          LEFT JOIN grades g ON g.task_id = t.id AND g.user_id = ?
          WHERE t.id IN (SELECT task_id FROM task_assignments WHERE user_id = ?
                         UNION SELECT task_id FROM task_progress WHERE user_id = ?
                         UNION SELECT task_id FROM task_answers WHERE user_id = ? AND TRIM(answer) <> ''
                         UNION SELECT task_id FROM grades WHERE user_id = ?)
          ORDER BY t.due_at`,
    args: Array(8).fill(userId),
  });
  const count = async (sql: string, args: InValue[]) =>
    Number((await db().execute({ sql, args })).rows[0]?.n ?? 0);
  return {
    id: Number(r.id),
    email: String(r.email),
    emails: [String(r.email), ...String(r.linked ?? "").split(" ").filter(Boolean)],
    fullName: (r.full_name as string | null) ?? null,
    lastSeenAt: Number(r.seen) > 0 ? Number(r.seen) : null,
    role: String(r.role),
    mergedInto: r.merged_into != null ? Number(r.merged_into) : null,
    tasks: tasks.rows.map((t) => {
      const submitted = t.submitted_at != null;
      const pct = Number(t.progress_pct ?? 0);
      const state = submitted
        ? "הוגשה"
        : t.opened_at != null
          ? "בלימוד"
          : Number(t.assigned)
            ? "טרם נפתחה"
            : "לא מוקצית (עבודה שמורה)";
      const grade =
        t.approved_at != null && t.score != null
          ? `ציון ${Number(t.score)}`
          : t.score != null
            ? `ציון ${Number(t.score)} (טרם אושר)`
            : t.claude_score != null
              ? `הצעת ציון ${Number(t.claude_score)}`
              : null;
      return {
        taskId: Number(t.id),
        title: String(t.title),
        state,
        progressPct: pct,
        submitted,
        answers: Number(t.answers ?? 0),
        grade,
      };
    }),
    writing: await count("SELECT COUNT(*) AS n FROM writing_results WHERE user_id = ?", [userId]),
    messages: await count(
      "SELECT COUNT(*) AS n FROM messages WHERE from_user_id = ? OR to_user_id = ?",
      [userId, userId]
    ),
    questions: await count("SELECT COUNT(*) AS n FROM question_bank WHERE user_id = ?", [userId]),
  };
}

// ---------- "ייתכן שזה אותו תלמיד" ----------

// A rough consonant skeleton that lets a Hebrew name and its Latin spelling
// meet: "קופמן" and "kaufman" both become "kpmn", "גוני" and "guni" "gn".
const HEB: Record<string, string> = {
  ב: "b", ג: "g", ד: "d", ז: "z", ח: "k", ט: "t", כ: "k", ך: "k", ל: "l", מ: "m", ם: "m",
  נ: "n", ן: "n", ס: "s", פ: "p", ף: "p", צ: "x", ץ: "x", ק: "k", ר: "r", ש: "s", ת: "t",
};

function skeleton(token: string): string {
  if (/[֐-׿]/.test(token)) {
    return [...token]
      .map((ch) => HEB[ch] ?? "")
      .join("")
      .replace(/(.)\1+/g, "$1");
  }
  return token
    .toLowerCase()
    .replace(/tz|ts/g, "x")
    .replace(/sh/g, "s")
    .replace(/ph|f/g, "p")
    .replace(/[vw]/g, "b")
    .replace(/[cq]/g, "k")
    .replace(/h/g, "")
    .replace(/[aeiouy]/g, "")
    .replace(/[^a-z]/g, "")
    .replace(/(.)\1+/g, "$1");
}

function nameTokens(fullName: string | null, email: string): string[] {
  const local = email.split("@")[0] ?? "";
  const words = `${fullName ?? ""} ${local}`
    .replace(/[֑-ׇ]/g, "")
    .split(/[\s._\-0-9'"׳״]+/)
    .map(skeleton)
    .filter((t) => t.length >= 2);
  return [...new Set(words)];
}

// Pairs of accounts whose names look alike — only a hint for the teacher,
// never an automatic merge.
export function similarAccounts(
  accounts: { id: number; fullName: string | null; email: string }[]
): Map<number, number[]> {
  const tokens = accounts.map((a) => ({ id: a.id, t: new Set(nameTokens(a.fullName, a.email)) }));
  const out = new Map<number, number[]>();
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      const shared = [...tokens[i].t].filter((x) => tokens[j].t.has(x));
      if (shared.length >= 2 || shared.some((x) => x.length >= 4)) {
        out.set(tokens[i].id, [...(out.get(tokens[i].id) ?? []), tokens[j].id]);
        out.set(tokens[j].id, [...(out.get(tokens[j].id) ?? []), tokens[i].id]);
      }
    }
  }
  return out;
}
