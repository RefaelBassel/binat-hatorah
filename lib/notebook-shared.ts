import { gematria, stripNikud } from "./hebrew";

// Client-safe pieces of the student notebook (issue #52): shapes, HTML
// sanitizing, plain-text extraction, and the Israel-time date labels.

export interface NotebookEntry {
  id: number;
  entryDate: string; // 'YYYY-MM-DD' in Israel time; fixed at creation
  title: string;
  unitKey: string; // tasks.content_ref or ""
  body: string; // sanitized HTML
  createdAt: number;
  updatedAt: number;
}

export interface NotebookUnit {
  key: string;
  label: string;
}

export const NOTEBOOK_TITLE_MAX = 200;
export const NOTEBOOK_BODY_MAX = 100_000;

// ── HTML: only bold/italic, lists and line breaks survive ───────────────
const ALLOWED_TAGS = new Set(["b", "strong", "i", "em", "u", "ul", "ol", "li", "br", "p", "div"]);

// Removes every tag outside the whitelist and every attribute, so the stored
// text can be rendered with dangerouslySetInnerHTML for the student and the
// teacher. Nikud and verses are plain text and pass through untouched.
export function sanitizeNotebookHtml(html: string): string {
  const out: string[] = [];
  let last = 0;
  const re = /<[^>]*>/g;
  const text = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    out.push(text(html.slice(last, m.index)));
    last = m.index + m[0].length;
    const tag = /^<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)/.exec(m[0]);
    if (!tag) continue;
    const name = tag[2].toLowerCase();
    if (!ALLOWED_TAGS.has(name)) continue;
    out.push(name === "br" ? "<br>" : tag[1] ? `</${name}>` : `<${name}>`);
  }
  out.push(text(html.slice(last)));
  return out.join("");
}

// Plain text of a body: for search, snippets and the exam-summary import
export function notebookText(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Search ignores nikud, taamim and case
export function searchKey(s: string): string {
  return stripNikud(s).toLowerCase();
}

// ── Dates (Israel time) ─────────────────────────────────────────────────
export function israelDateStr(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function isDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// "9.11.2026"
export function shortDate(dateStr: string): string {
  const [y, mo, da] = dateStr.split("-").map(Number);
  return `${da}.${mo}.${y}`;
}

// "יום שני, 9.11.2026 · כ״ח בחשוון" (English: "Monday, 9.11.2026 · 28 Cheshvan")
export function formatEntryDate(dateStr: string, lang: "he" | "en" = "he"): string {
  if (!isDateStr(dateStr)) return dateStr;
  const [y, mo, da] = dateStr.split("-").map(Number);
  // noon UTC keeps the calendar day stable in every timezone
  const d = new Date(Date.UTC(y, mo - 1, da, 12));
  const greg = `${da}.${mo}.${y}`;
  const weekday = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "he-IL", {
    weekday: "long",
    timeZone: "UTC",
  }).format(d);
  const parts = new Intl.DateTimeFormat(lang === "en" ? "en-u-ca-hebrew" : "he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  if (lang === "en") return `${weekday}, ${greg} · ${get("day")} ${get("month")}`;
  const dayNum = parseInt(get("day"), 10);
  const hebDay = Number.isFinite(dayNum) ? gematria(dayNum) : get("day");
  return `${weekday}, ${greg} · ${hebDay} ב${get("month")}`;
}
