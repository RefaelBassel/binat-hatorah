import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { getAnthropicApiKey } from "./env";
import type { PassageBlock, PassageVerse, TaskContent } from "@/content/tasks/types";

// Per-student task language (Reut, 2026-11-02, request #12): a student set to
// English sees every task in English — titles, stages, the check, the
// worksheet, writing practices and the page's buttons — while the Bible and
// the commentators stay in Hebrew with an English translation beside them
// (verses: JPS 1917 from Sefaria, public domain; commentators: a faithful
// translation marked "(translation)"). The class and the teacher see nothing
// different.
//
// Every string is translated once and cached by its Hebrew text, so a
// teacher's edit re-translates only what changed.

export type TaskLang = "he" | "en";

// Zahava Azous (userId 11) is set to English per the request; the teacher can
// change it in the roster.
const PRESET_EN = ["zahava@azous.com"];

const TRANSLATE_MODEL = "claude-sonnet-5-5";
const JPS = "The Holy Scriptures: A New Translation (JPS 1917)";

let ready = false;
async function ensure() {
  if (ready) return;
  try {
    await db().execute("ALTER TABLE users ADD COLUMN task_lang TEXT");
  } catch {
    /* column exists */
  }
  await db().execute(
    `CREATE TABLE IF NOT EXISTS translation_cache (
       hash TEXT PRIMARY KEY,
       kind TEXT NOT NULL,
       source TEXT NOT NULL,
       target TEXT NOT NULL,
       created_at INTEGER NOT NULL
     )`
  );
  for (const email of PRESET_EN) {
    await db().execute({ sql: "UPDATE users SET task_lang = 'en' WHERE email = ? AND task_lang IS NULL", args: [email] });
  }
  ready = true;
}

export async function getTaskLang(userId: number): Promise<TaskLang> {
  await ensure();
  const r = await db().execute({ sql: "SELECT task_lang FROM users WHERE id = ?", args: [userId] });
  return String(r.rows[0]?.task_lang ?? "") === "en" ? "en" : "he";
}

export async function setTaskLang(userId: number, lang: TaskLang) {
  await ensure();
  await db().execute({ sql: "UPDATE users SET task_lang = ? WHERE id = ?", args: [lang, userId] });
}

export async function englishUserIds(): Promise<Set<number>> {
  await ensure();
  const r = await db().execute("SELECT id FROM users WHERE task_lang = 'en'");
  return new Set(r.rows.map((x) => Number(x.id)));
}

// ------------------------------------------------------------ the cache ----
const hashOf = (kind: string, s: string) => createHash("sha256").update(`${kind}\n${s}`).digest("hex");

async function cached(kind: string, sources: string[]): Promise<Map<string, string>> {
  await ensure();
  const out = new Map<string, string>();
  const uniq = [...new Set(sources)];
  for (let i = 0; i < uniq.length; i += 200) {
    const part = uniq.slice(i, i + 200);
    const hashes = part.map((s) => hashOf(kind, s));
    const r = await db().execute({
      sql: `SELECT source, target FROM translation_cache WHERE hash IN (${hashes.map(() => "?").join(",")})`,
      args: hashes,
    });
    for (const row of r.rows) out.set(String(row.source), String(row.target));
  }
  return out;
}

async function store(kind: string, pairs: [string, string][]) {
  const t = Math.floor(Date.now() / 1000);
  for (const [s, e] of pairs) {
    await db().execute({
      sql: "INSERT INTO translation_cache (hash, kind, source, target, created_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET target = excluded.target",
      args: [hashOf(kind, s), kind, s, e, t],
    });
  }
}

// ------------------------------------------------------- Claude translates ----
type Kind = "content" | "ui" | "source" | "verse" | "to-he";

const INSTRUCTIONS: Record<Kind, string> = {
  content:
    "You translate the text of a Hebrew Bible-study task for a 10th-grade girl who reads English (a high school in Israel). Translate each item from Hebrew to clear, natural English for a teenager. Keep emojis, numbers, punctuation style and line breaks. When an item quotes a verse or a Hebrew phrase in quotation marks (״…״ or \"…\"), keep the Hebrew quote exactly and add the English in parentheses right after it, e.g. ״וַיִּשְׁלַח מֹשֶׁה״ (\"And Moses sent\"). Keep Hebrew names of biblical books and people in their usual English form (Numbers, Moses, Aaron, Miriam). Do not add or drop content.",
  ui: "You translate short interface strings of a Hebrew learning website (buttons, labels, messages, instructions on a task page) into concise natural English. Keep emojis and punctuation. Address the student directly (\"you\"). Keep every {} placeholder exactly, in the natural position for English. Do not add content.",
  source:
    "You translate a passage of classical Jewish commentary (Rashi, Ramban, the Sages, Sforno and the like) from Hebrew into faithful, readable English. Keep the commentator's structure. Do not explain or add.",
  verse:
    "You translate verses of the Hebrew Bible into English. Use the wording of the JPS 1917 translation where you know it; otherwise a faithful literal translation in the same style.",
  "to-he": "You translate a student's answer from English into natural Hebrew for her teacher. Keep the meaning exactly, do not improve or correct it.",
};

const TOOL: Anthropic.Tool = {
  name: "translations",
  description: "The translation of every item, by its index",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: { i: { type: "integer" }, text: { type: "string" } },
          required: ["i", "text"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  strict: true,
};

async function claudeTranslate(kind: Kind, items: string[]): Promise<string[]> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error("no Claude key");
  const client = new Anthropic({ apiKey, timeout: 240_000, maxRetries: 2 });
  const msg = await client.messages.create({
    model: TRANSLATE_MODEL,
    max_tokens: 32000,
    system: [{ type: "text", text: `${INSTRUCTIONS[kind]}\nReturn the result only through the translations tool: one entry per input item, with the same index i.` }],
    tools: [TOOL],
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    messages: [{ role: "user", content: JSON.stringify(items.map((text, i) => ({ i, text }))) }],
  });
  const tool = msg.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  const got = ((tool?.input as { items?: { i: number; text: string }[] } | undefined)?.items ?? []).filter(
    (x) => typeof x?.i === "number" && typeof x?.text === "string"
  );
  const out = items.map(() => "");
  for (const x of got) if (x.i >= 0 && x.i < items.length) out[x.i] = x.text;
  return out;
}

// translate many strings; cached ones are free, the rest go out in chunks
export async function translate(kind: Kind, sources: string[]): Promise<Map<string, string>> {
  const clean = sources.map((s) => s).filter((s) => s && /[֐-׿a-zA-Z]/.test(s));
  const have = await cached(kind, clean);
  const missing = [...new Set(clean.filter((s) => !have.has(s)))];
  let chunk: string[] = [];
  let size = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const done = await claudeTranslate(kind, chunk);
    const pairs: [string, string][] = [];
    chunk.forEach((s, i) => {
      if (done[i]) {
        have.set(s, done[i]);
        pairs.push([s, done[i]]);
      }
    });
    await store(kind, pairs);
    chunk = [];
    size = 0;
  };
  for (const s of missing) {
    if (size + s.length > 5000 && chunk.length) await flush();
    chunk.push(s);
    size += s.length;
  }
  await flush();
  return have;
}

// ------------------------------------------------------------ the verses ----
function stripHtml(s: string): string {
  return s
    .replace(/<sup[^>]*>.*?<\/sup>/g, "")
    .replace(/<i class="footnote">.*?<\/i>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const jpsMemo = new Map<string, string[]>();
async function jpsVerses(ref: string): Promise<string[] | null> {
  if (jpsMemo.has(ref)) return jpsMemo.get(ref)!;
  const have = await cached("jps", [ref]);
  if (have.has(ref)) {
    const v = JSON.parse(have.get(ref)!) as string[];
    jpsMemo.set(ref, v);
    return v;
  }
  try {
    const r = await fetch(`https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=${encodeURIComponent(`english|${JPS}`)}`, {
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return null;
    const d = (await r.json()) as { versions?: { text: unknown }[] };
    const raw = d.versions?.[0]?.text;
    const flat: string[] = [];
    const walk = (x: unknown) => {
      if (typeof x === "string") flat.push(stripHtml(x));
      else if (Array.isArray(x)) x.forEach(walk);
    };
    walk(raw);
    if (!flat.length) return null;
    await store("jps", [[ref, JSON.stringify(flat)]]);
    jpsMemo.set(ref, flat);
    return flat;
  } catch {
    return null;
  }
}

const verseKey = (t: string) => t.replace(/[֑-ׇ]/g, "").replace(/[^א-ת]/g, "");

// ------------------------------------------------------ the whole content ----
// keys whose values are identifiers, Hebrew data or Claude-only hints
const SKIP = new Set(["key", "type", "icon", "art", "ref", "sefariaRef", "passageKey", "num", "kind", "expectedLeitwort", "contentRef", "id"]);

export async function translateContent(content: TaskContent): Promise<TaskContent> {
  const clone = JSON.parse(JSON.stringify(content)) as TaskContent;

  // 1. verses: JPS 1917 where the passage has a Sefaria ref; help verses and
  //    others reuse those by their Hebrew text, the rest Claude translates
  const byText = new Map<string, string>();
  const passages: PassageVerse[][] = [];
  const visitPassages = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(visitPassages);
    const o = node as Record<string, unknown>;
    if (Array.isArray(o.verses)) passages.push(o.verses as PassageVerse[]);
    for (const v of Object.values(o)) visitPassages(v);
  };
  visitPassages(clone);
  const sefaria: { ref: string; verses: PassageVerse[] }[] = [];
  const findRefs = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(findRefs);
    const o = node as Record<string, unknown>;
    if (o.type === "passage" && typeof o.sefariaRef === "string" && Array.isArray(o.verses)) sefaria.push({ ref: o.sefariaRef, verses: o.verses as PassageVerse[] });
    for (const v of Object.values(o)) findRefs(v);
  };
  findRefs(clone);
  for (const p of sefaria) {
    const en = await jpsVerses(p.ref);
    if (en && en.length === p.verses.length) p.verses.forEach((v, i) => byText.set(verseKey(v.text), `${en[i]}`));
  }
  const leftover: string[] = [];
  for (const vs of passages) for (const v of vs) if (!byText.has(verseKey(v.text))) leftover.push(v.text);
  const verseMap = leftover.length ? await translate("verse", leftover) : new Map<string, string>();
  for (const vs of passages) {
    for (const v of vs) {
      v.en = byText.get(verseKey(v.text)) ?? verseMap.get(v.text) ?? undefined;
    }
  }

  // 2. commentators: Hebrew stays, the translation goes beside it
  const sources: { text: string; o: Record<string, unknown> }[] = [];
  const findSources = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(findSources);
    const o = node as Record<string, unknown>;
    if (o.type === "source" && typeof o.text === "string") sources.push({ text: o.text, o });
    for (const v of Object.values(o)) findSources(v);
  };
  findSources(clone);
  const srcMap = sources.length ? await translate("source", sources.map((s) => s.text)) : new Map<string, string>();
  for (const s of sources) {
    const en = srcMap.get(s.text);
    if (en) s.o.textEn = `${en} (translation)`;
  }

  // 3. every other string
  const strings: string[] = [];
  const collect = (node: unknown, key: string | null, parentIsVerse: boolean) => {
    if (typeof node === "string") {
      if (key && SKIP.has(key)) return;
      if (parentIsVerse) return;
      if (/[֐-׿]/.test(node)) strings.push(node);
      return;
    }
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach((x) => collect(x, key, parentIsVerse));
    const o = node as Record<string, unknown>;
    const isVerse = typeof o.num === "string" && typeof o.text === "string";
    const isSource = o.type === "source";
    for (const [k, v] of Object.entries(o)) {
      if (isSource && k === "text") continue;
      if (k === "textEn" || k === "en") continue;
      collect(v, k, isVerse);
    }
  };
  collect(clone, null, false);
  const map = strings.length ? await translate("content", strings) : new Map<string, string>();
  const apply = (node: unknown, key: string | null, parentIsVerse: boolean): unknown => {
    if (typeof node === "string") {
      if ((key && SKIP.has(key)) || parentIsVerse) return node;
      return map.get(node) ?? node;
    }
    if (!node || typeof node !== "object") return node;
    if (Array.isArray(node)) return node.map((x) => apply(x, key, parentIsVerse));
    const o = node as Record<string, unknown>;
    const isVerse = typeof o.num === "string" && typeof o.text === "string";
    const isSource = o.type === "source";
    for (const [k, v] of Object.entries(o)) {
      if (isSource && k === "text") continue;
      if (k === "textEn" || k === "en") continue;
      o[k] = apply(v, k, isVerse);
    }
    return o;
  };
  return apply(clone, null, false) as TaskContent;
}

// The task together with its main passage (the page gets them separately)
export async function translateTask(content: TaskContent, mainPassage: PassageBlock): Promise<{ content: TaskContent; mainPassage: PassageBlock }> {
  const both = (await translateContent({ ...(content as object), __main: mainPassage } as unknown as TaskContent)) as unknown as TaskContent & { __main: PassageBlock };
  const { __main, ...rest } = both;
  return { content: rest as TaskContent, mainPassage: __main };
}

// The task page's interface strings for the browser's translation layer
export async function uiDictionary(strings: readonly string[]): Promise<Record<string, string>> {
  const map = await translate("ui", [...strings]);
  return Object.fromEntries(map);
}

// A student's English answer, in Hebrew for the teacher
export async function answerToHebrew(text: string): Promise<string> {
  const map = await translate("to-he", [text]);
  return map.get(text) ?? "";
}

// one line for Claude prompts that talk to the student
export const ENGLISH_REPLY_RULE =
  "The student reads English: write everything you say to her in clear English. When you quote a verse or a Hebrew phrase, keep it in Hebrew and add the English in parentheses.";
