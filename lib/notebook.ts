import { db } from "./db";
import {
  NOTEBOOK_BODY_MAX,
  NOTEBOOK_TITLE_MAX,
  israelDateStr,
  sanitizeNotebookHtml,
  type NotebookEntry,
  type NotebookUnit,
} from "./notebook-shared";

// The student notebook (issue #52). Server-only. The table is created lazily
// (canonical DDL: migrations/0023_notebook.sql). Entries are private to the
// student and the teachers; nothing here grades or checks them.

const DDL = [
  `CREATE TABLE IF NOT EXISTS notebook_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    entry_date TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    unit_key TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE UNIQUE INDEX IF NOT EXISTS idx_notebook_user_date ON notebook_entries(user_id, entry_date)",
];

let ready = false;
async function ensureNotebookTable() {
  if (ready) return;
  for (const stmt of DDL) await db().execute(stmt);
  ready = true;
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function toEntry(r: Record<string, unknown>): NotebookEntry {
  return {
    id: Number(r.id),
    entryDate: String(r.entry_date),
    title: String(r.title ?? ""),
    unitKey: String(r.unit_key ?? ""),
    body: sanitizeNotebookHtml(String(r.body ?? "")),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

// The units a student can pick: the published tasks, one per unit
// (tasks.content_ref), newest title wins. Cancelled-and-unpublished tasks
// never appear; units already used by an entry are added by the caller.
export async function listNotebookUnits(): Promise<NotebookUnit[]> {
  const res = await db().execute({
    sql: "SELECT content_ref, title FROM tasks WHERE published_at <= ? ORDER BY published_at ASC, id ASC",
    args: [nowSec()],
  });
  const map = new Map<string, string>();
  for (const r of res.rows) map.set(String(r.content_ref), String(r.title));
  return [...map].map(([key, label]) => ({ key, label }));
}

// Units for the pickers/filters: the published ones plus any unit an entry
// still points at (its task may have been unpublished since).
export function unitsWithEntries(units: NotebookUnit[], entries: NotebookEntry[]): NotebookUnit[] {
  const known = new Set(units.map((u) => u.key));
  const extra = [...new Set(entries.map((e) => e.unitKey).filter((k) => k && !known.has(k)))].map((key) => ({
    key,
    label: key,
  }));
  return [...units, ...extra];
}

export async function listEntries(userId: number, unitKey?: string): Promise<NotebookEntry[]> {
  await ensureNotebookTable();
  const res = await db().execute({
    sql: `SELECT * FROM notebook_entries WHERE user_id = ? ${unitKey ? "AND unit_key = ?" : ""}
          ORDER BY entry_date DESC, id DESC`,
    args: unitKey ? [userId, unitKey] : [userId],
  });
  return res.rows.map((r) => toEntry(r as Record<string, unknown>));
}

export async function countEntries(userId: number): Promise<number> {
  await ensureNotebookTable();
  const res = await db().execute({ sql: "SELECT COUNT(*) AS n FROM notebook_entries WHERE user_id = ?", args: [userId] });
  return Number(res.rows[0]?.n ?? 0);
}

// Today's entry (Israel date): created on first use, opened ever after. The
// unique (user, date) index makes two quick clicks land on the same row.
export async function getOrCreateToday(
  userId: number,
  unitKey = ""
): Promise<{ entry: NotebookEntry; created: boolean }> {
  await ensureNotebookTable();
  const date = israelDateStr();
  const t = nowSec();
  const ins = await db().execute({
    sql: `INSERT OR IGNORE INTO notebook_entries (user_id, entry_date, unit_key, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: [userId, date, unitKey, t, t],
  });
  const res = await db().execute({
    sql: "SELECT * FROM notebook_entries WHERE user_id = ? AND entry_date = ?",
    args: [userId, date],
  });
  return { entry: toEntry(res.rows[0] as Record<string, unknown>), created: ins.rowsAffected > 0 };
}

export interface EntryPatch {
  title?: string;
  unitKey?: string;
  body?: string;
}

// entry_date and created_at are never touched here: the original date stays.
export async function updateEntry(
  id: number,
  userId: number,
  patch: EntryPatch
): Promise<NotebookEntry | null> {
  await ensureNotebookTable();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.title != null) {
    sets.push("title = ?");
    args.push(patch.title.slice(0, NOTEBOOK_TITLE_MAX));
  }
  if (patch.unitKey != null) {
    sets.push("unit_key = ?");
    args.push(patch.unitKey);
  }
  if (patch.body != null) {
    sets.push("body = ?");
    args.push(sanitizeNotebookHtml(patch.body.slice(0, NOTEBOOK_BODY_MAX)));
  }
  if (sets.length > 0) {
    sets.push("updated_at = ?");
    args.push(nowSec(), id, userId);
    await db().execute({
      sql: `UPDATE notebook_entries SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
      args,
    });
  }
  const res = await db().execute({
    sql: "SELECT * FROM notebook_entries WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return res.rows[0] ? toEntry(res.rows[0] as Record<string, unknown>) : null;
}

export async function deleteEntry(id: number, userId: number): Promise<boolean> {
  await ensureNotebookTable();
  const res = await db().execute({
    sql: "DELETE FROM notebook_entries WHERE id = ? AND user_id = ?",
    args: [id, userId],
  });
  return res.rowsAffected > 0;
}

// Entries for a print page, oldest first, filtered by date range / unit.
export async function entriesForPrint(
  userId: number,
  opts: { from?: string; to?: string; unit?: string }
): Promise<NotebookEntry[]> {
  const all = await listEntries(userId, opts.unit || undefined);
  return all
    .filter((e) => (!opts.from || e.entryDate >= opts.from) && (!opts.to || e.entryDate <= opts.to))
    .reverse();
}

export async function notebookOwnerName(userId: number): Promise<string> {
  const res = await db().execute({ sql: "SELECT full_name, email FROM users WHERE id = ?", args: [userId] });
  const r = res.rows[0];
  return r ? ((r.full_name as string | null) ?? String(r.email)) : "";
}

// Hebrew unit labels → English for a student set to English (cached
// translations only, so no page ever waits on Claude).
export async function translateUnitLabels(units: NotebookUnit[]): Promise<NotebookUnit[]> {
  try {
    const { contentLookup } = await import("./task-lang");
    const tr = await contentLookup(units.map((u) => u.label), false);
    return units.map((u) => ({ ...u, label: tr(u.label) }));
  } catch {
    return units;
  }
}
