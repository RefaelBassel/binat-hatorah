import { db } from "./db";
import type {
  TaskContent,
  EditableTaskContent,
  CheckQuestion,
} from "@/content/tasks/types";

// Teacher-editable task content. The TypeScript content files are only the
// DEFAULTS: anything the teacher edits in place (the comprehension check,
// the plenary question, the opening deck) is stored here, keyed by the
// content ref, and wins over the file. Edits therefore survive republishing
// a task and never require a code change.

export type EditableField = keyof EditableTaskContent;
export const EDITABLE_FIELDS: EditableField[] = ["check", "checkOpen", "plenary", "opening"];

let ready = false;
export async function ensureOverridesTable() {
  if (ready) return;
  await db().execute(
    `CREATE TABLE IF NOT EXISTS task_content_overrides (
       content_ref TEXT NOT NULL,
       field TEXT NOT NULL,
       value_json TEXT NOT NULL,
       updated_at INTEGER NOT NULL,
       updated_by INTEGER,
       PRIMARY KEY (content_ref, field)
     )`
  );
  ready = true;
}

export type Overrides = Partial<EditableTaskContent>;

export async function getOverrides(contentRef: string): Promise<Overrides> {
  await ensureOverridesTable();
  const res = await db().execute({
    sql: "SELECT field, value_json FROM task_content_overrides WHERE content_ref = ?",
    args: [contentRef],
  });
  const out: Record<string, unknown> = {};
  for (const r of res.rows) {
    const field = String(r.field);
    if (!EDITABLE_FIELDS.includes(field as EditableField)) continue;
    try {
      out[field] = JSON.parse(String(r.value_json));
    } catch {
      /* ignore a corrupt row — the file default stands */
    }
  }
  return out as Overrides;
}

export async function setOverride(
  contentRef: string,
  field: EditableField,
  value: unknown,
  userId: number
) {
  await ensureOverridesTable();
  await db().execute({
    sql: `INSERT INTO task_content_overrides (content_ref, field, value_json, updated_at, updated_by)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(content_ref, field) DO UPDATE SET
            value_json = excluded.value_json,
            updated_at = excluded.updated_at,
            updated_by = excluded.updated_by`,
    args: [contentRef, field, JSON.stringify(value), Math.floor(Date.now() / 1000), userId],
  });
}

// Back to the file default.
export async function clearOverride(contentRef: string, field: EditableField) {
  await ensureOverridesTable();
  await db().execute({
    sql: "DELETE FROM task_content_overrides WHERE content_ref = ? AND field = ?",
    args: [contentRef, field],
  });
}

// The content a page should actually render: file defaults + teacher edits.
export function applyOverrides(content: TaskContent, ov: Overrides): TaskContent {
  return { ...content, ...ov };
}

export async function effectiveContent(content: TaskContent): Promise<TaskContent> {
  return applyOverrides(content, await getOverrides(content.ref));
}

// ---------- validation of teacher edits (server side) ----------

const str = (v: unknown, max = 2000) =>
  typeof v === "string" ? v.trim().slice(0, max) : "";

export function sanitizeCheck(raw: unknown): CheckQuestion[] | null {
  if (!Array.isArray(raw)) return null;
  const out: CheckQuestion[] = [];
  for (const q of raw.slice(0, 12)) {
    if (!q || typeof q !== "object") return null;
    const o = q as Record<string, unknown>;
    const kind = o.kind === "truefalse" || o.kind === "order" ? o.kind : "choice";
    const prompt = str(o.prompt, 600);
    if (!prompt) return null;
    let options = Array.isArray(o.options)
      ? o.options.map((x) => str(x, 300)).filter(Boolean).slice(0, 8)
      : [];
    let answer = Number.isInteger(o.answer) ? Number(o.answer) : 0;
    if (kind === "truefalse") {
      options = ["נכון", "לא נכון"];
      answer = answer === 1 ? 1 : 0;
    } else if (kind === "order") {
      if (options.length < 2) return null;
      answer = 0;
    } else {
      if (options.length < 2) return null;
      if (answer < 0 || answer >= options.length) return null;
    }
    out.push({
      key: str(o.key, 60) || `q${out.length + 1}`,
      kind,
      prompt,
      part: str(o.part, 160) || "כללי",
      options,
      answer,
    });
  }
  // keys must be unique — they are the storage keys of the answers
  const seen = new Set<string>();
  for (const q of out) {
    if (seen.has(q.key)) return null;
    seen.add(q.key);
  }
  return out;
}

export function sanitizeField(field: EditableField, raw: unknown): unknown | null {
  switch (field) {
    case "check":
      return sanitizeCheck(raw);
    case "checkOpen": {
      if (raw == null) return null;
      const o = raw as Record<string, unknown>;
      const prompt = str(o.prompt, 600);
      if (!prompt) return null;
      return { key: str(o.key, 60) || "open", prompt };
    }
    case "plenary": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const question = str(o.question, 800);
      return question ? { question } : null;
    }
    case "opening": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const opener = str(o.opener, 800);
      if (!opener) return null;
      const hook = str(o.hook, 800);
      return hook ? { opener, hook } : { opener };
    }
  }
}
