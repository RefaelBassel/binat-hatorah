import { db } from "./db";
import type {
  TaskContent,
  TaskSection,
  QuestionBlock,
  QuestionIcon,
  EditableTaskContent,
  CheckQuestion,
} from "@/content/tasks/types";

// Teacher-editable task content. The TypeScript content files are only the
// DEFAULTS: anything the teacher edits in place (the comprehension check,
// the plenary question, the opening deck) is stored here, keyed by the
// content ref, and wins over the file. Edits therefore survive republishing
// a task and never require a code change.

// Rafael (2026-09-30): "ריעות תוכל לערוך הכל כולל הכול" — so beyond the four
// fields above, every text on the task is hers: the worksheet questions of
// Part B (reword, relabel, hide, add) and the unit's own texts (title line,
// section headers, intro / case / source / art captions, Part A settings).
export interface ExtraQuestion {
  sectionKey: string;
  key: string;
  prompt: string;
  label?: string;
  icon?: QuestionIcon;
}
export interface WorksheetEdits {
  hidden: string[]; // question keys removed from the worksheet
  prompts: Record<string, string>; // question key -> new prompt
  labels: Record<string, string>; // question key -> new label above the prompt
  helpers: Record<string, string>; // question key -> new helper line
  extra: ExtraQuestion[]; // teacher-added questions, appended to their section
}
export interface UnitEdits {
  title?: string;
  subtitle?: string;
  skill?: string;
  bookRef?: string;
  heroCaption?: string;
  genreOptions?: string[]; // Part A genre stage
  minQuestions?: number; // Part A question stage
  sections: Record<string, { title?: string; minutes?: number }>;
  blocks: Record<string, { title?: string; body?: string; text?: string; caption?: string }>;
}
export const EMPTY_EDITS: WorksheetEdits = { hidden: [], prompts: {}, labels: {}, helpers: {}, extra: [] };
export const EMPTY_UNIT: UnitEdits = { sections: {}, blocks: {} };

export type Overrides = Partial<EditableTaskContent> & { worksheet?: WorksheetEdits; unit?: UnitEdits };
export type EditableField = keyof Overrides;
export const EDITABLE_FIELDS: EditableField[] = ["check", "checkOpen", "plenary", "opening", "worksheet", "unit"];

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
export function applyWorksheetEdits(sections: TaskSection[], edits: WorksheetEdits | undefined): TaskSection[] {
  if (!edits) return sections;
  const hidden = new Set(edits.hidden);
  return sections.map((sec) => {
    const blocks = sec.blocks
      .filter((b) => b.type !== "question" || !hidden.has(b.key))
      .map((b) => {
        if (b.type !== "question") return b;
        const q = b as QuestionBlock;
        return {
          ...q,
          prompt: edits.prompts?.[q.key] || q.prompt,
          label: edits.labels?.[q.key] || q.label,
          helper: edits.helpers?.[q.key] ?? q.helper,
        };
      });
    const extras: QuestionBlock[] = (edits.extra ?? [])
      .filter((e) => e.sectionKey === sec.key && !hidden.has(e.key))
      .map((e) => ({
        type: "question",
        key: e.key,
        icon: e.icon ?? "thinking",
        label: edits.labels?.[e.key] || e.label || "שאלה של המורה",
        prompt: edits.prompts?.[e.key] || e.prompt,
      }));
    return { ...sec, blocks: [...blocks, ...extras] };
  });
}

export function applyUnitEdits(sections: TaskSection[], u: UnitEdits | undefined): TaskSection[] {
  if (!u) return sections;
  return sections.map((sec) => {
    const se = u.sections?.[sec.key];
    const blocks = sec.blocks.map((b) => {
      const be = u.blocks?.[b.key];
      if (!be) return b;
      switch (b.type) {
        case "intro":
          return { ...b, title: be.title ?? b.title, body: be.body ?? b.body };
        case "case":
          return { ...b, title: be.title ?? b.title, body: be.body ?? b.body };
        case "source":
          return { ...b, title: be.title ?? b.title, text: be.text ?? b.text };
        case "art":
          return { ...b, caption: be.caption ?? b.caption };
        default:
          return b;
      }
    });
    return { ...sec, title: se?.title ?? sec.title, minutes: se?.minutes ?? sec.minutes, blocks };
  });
}

export function applyOverrides(content: TaskContent, ov: Overrides): TaskContent {
  const u = ov.unit;
  return {
    ...content,
    ...(ov.check ? { check: ov.check } : {}),
    ...(ov.checkOpen ? { checkOpen: ov.checkOpen } : {}),
    ...(ov.plenary ? { plenary: ov.plenary } : {}),
    ...(ov.opening ? { opening: ov.opening } : {}),
    title: u?.title || content.title,
    subtitle: u?.subtitle ?? content.subtitle,
    skill: u?.skill || content.skill,
    bookRef: u?.bookRef || content.bookRef,
    heroArt: content.heroArt && u?.heroCaption ? { ...content.heroArt, caption: u.heroCaption } : content.heroArt,
    decode: {
      ...content.decode,
      genreOptions: u?.genreOptions?.length ? u.genreOptions : content.decode.genreOptions,
      minQuestions: u?.minQuestions ?? content.decode.minQuestions,
    },
    sections: applyUnitEdits(applyWorksheetEdits(content.sections, ov.worksheet), u),
  };
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
    case "worksheet": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const hidden = Array.isArray(o.hidden) ? [...new Set(o.hidden.map((k) => str(k, 80)).filter(Boolean))] : [];
      const textMap = (v: unknown, max: number) => {
        const out: Record<string, string> = {};
        if (v && typeof v === "object") {
          for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
            const t = str(x, max);
            if (k && t) out[str(k, 80)] = t;
          }
        }
        return out;
      };
      const extra: ExtraQuestion[] = [];
      if (Array.isArray(o.extra)) {
        for (const e of o.extra.slice(0, 40)) {
          const x = (e ?? {}) as Record<string, unknown>;
          const sectionKey = str(x.sectionKey, 80);
          const key = str(x.key, 80);
          const prompt = str(x.prompt, 1500);
          if (!sectionKey || !key || !prompt) continue;
          extra.push({ sectionKey, key, prompt, label: str(x.label, 80) || undefined, icon: typeof x.icon === "string" ? (x.icon as QuestionIcon) : undefined });
        }
      }
      return { hidden, prompts: textMap(o.prompts, 1500), labels: textMap(o.labels, 120), helpers: textMap(o.helpers, 400), extra } satisfies WorksheetEdits;
    }
    case "unit": {
      const o = (raw ?? {}) as Record<string, unknown>;
      const sections: UnitEdits["sections"] = {};
      if (o.sections && typeof o.sections === "object") {
        for (const [k, v] of Object.entries(o.sections as Record<string, Record<string, unknown>>)) {
          const title = str(v?.title, 200);
          const minutes = Number(v?.minutes);
          const e: { title?: string; minutes?: number } = {};
          if (title) e.title = title;
          if (Number.isFinite(minutes) && minutes > 0 && minutes <= 120) e.minutes = Math.round(minutes);
          if (Object.keys(e).length) sections[str(k, 80)] = e;
        }
      }
      const blocks: UnitEdits["blocks"] = {};
      if (o.blocks && typeof o.blocks === "object") {
        for (const [k, v] of Object.entries(o.blocks as Record<string, Record<string, unknown>>)) {
          const e: { title?: string; body?: string; text?: string; caption?: string } = {};
          const title = str(v?.title, 200);
          const body = str(v?.body, 4000);
          const text = str(v?.text, 4000);
          const caption = str(v?.caption, 600);
          if (title) e.title = title;
          if (body) e.body = body;
          if (text) e.text = text;
          if (caption) e.caption = caption;
          if (Object.keys(e).length) blocks[str(k, 80)] = e;
        }
      }
      const out: UnitEdits = { sections, blocks };
      const title = str(o.title, 200);
      const subtitle = str(o.subtitle, 300);
      const skill = str(o.skill, 300);
      const bookRef = str(o.bookRef, 200);
      const heroCaption = str(o.heroCaption, 600);
      if (title) out.title = title;
      if (subtitle) out.subtitle = subtitle;
      if (skill) out.skill = skill;
      if (bookRef) out.bookRef = bookRef;
      if (heroCaption) out.heroCaption = heroCaption;
      if (Array.isArray(o.genreOptions)) {
        const g = o.genreOptions.map((x) => str(x, 60)).filter(Boolean).slice(0, 10);
        if (g.length >= 2) out.genreOptions = g;
      }
      const mq = Number(o.minQuestions);
      if (Number.isInteger(mq) && mq >= 1 && mq <= 10) out.minQuestions = mq;
      return out;
    }
  }
}
