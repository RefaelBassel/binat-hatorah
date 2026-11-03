import { db } from "./db";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "./content-overrides";

// Completion status + per-answer marks (issue #24) — replaces the numeric
// grade. The automatic check proposes a mark (and a short note) for every
// answer; the status follows from how many of the task's questions got a
// RELEVANT answer. Everything stays a draft until the teacher approves.
// Numeric scores already stored on grades are kept in the DB but are no
// longer shown to students. Server-only; the shared vocabulary lives in
// lib/completion-meta.ts.
export * from "./completion-meta";

export interface GradableQuestion {
  key: string; // task_answers.question_key
  section: string;
  label: string;
  prompt: string;
}

// The questions a task's status counts: the worksheet as the students see it
// — questions the teacher hid are left out, ones she added are in. A
// question with several fields counts each field as its own answer.
export async function gradableQuestions(contentRef: string): Promise<GradableQuestion[]> {
  const reg = getTaskContent(contentRef);
  if (!reg) return [];
  const content = await effectiveContent(reg.content);
  const out: GradableQuestion[] = [];
  for (const section of content.sections) {
    for (const block of section.blocks) {
      if (block.type !== "question") continue;
      if (block.fields?.length) {
        for (const f of block.fields) {
          out.push({
            key: `${block.key}:${f.key}`,
            section: section.title,
            label: `${block.label} — ${f.label}`,
            prompt: block.prompt,
          });
        }
      } else {
        out.push({ key: block.key, section: section.title, label: block.label, prompt: block.prompt });
      }
    }
  }
  return out;
}

// Lazily added columns on grades (canonical DDL:
// migrations/0016_completion_status.sql), so production needs no manual run.
// claude_status / claude_marks: the automatic proposal. status / marks: the
// teacher's draft (or final, once status_approved_at is set).
let ready = false;
export async function ensureCompletionColumns() {
  if (ready) return;
  const info = await db().execute("PRAGMA table_info(grades)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  const add: [string, string][] = [
    ["claude_status", "TEXT"],
    ["claude_marks", "TEXT"],
    ["status", "TEXT"],
    ["marks", "TEXT"],
    ["status_approved_at", "INTEGER"],
  ];
  for (const [name, type] of add) {
    if (cols.has(name)) continue;
    try {
      await db().execute(`ALTER TABLE grades ADD COLUMN ${name} ${type}`);
    } catch (e) {
      // a concurrent request may have added it a moment ago
      const again = await db().execute("PRAGMA table_info(grades)");
      if (!again.rows.some((r) => String(r.name) === name)) throw e;
    }
  }
  ready = true;
}
