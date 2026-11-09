import { db } from "./db";
import { ensureExamTables, getDoc, now } from "./exams";
import { parseDeckText, parseSlides, type DeckSlide } from "./deck-types";
import { SEED_DECK_TEXT } from "./deck-seed";
import { SEED_EXAM_TITLE } from "./exam-seed";

// Review presentations (issue #48). Server-only, teacher-only. The table is
// created lazily; canonical DDL: migrations/0021_exam_decks.sql.

const DDL = [
  `CREATE TABLE IF NOT EXISTS exam_decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    exam_id INTEGER REFERENCES exam_docs(id),
    slides_json TEXT NOT NULL DEFAULT '[]',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_exam_decks_exam ON exam_decks(exam_id)",
];

let ready = false;
async function ensureDeckTable() {
  if (ready) return;
  await ensureExamTables();
  for (const stmt of DDL) await db().execute(stmt);
  ready = true;
}

export interface DeckRow {
  id: number;
  title: string;
  examId: number | null;
  slides: DeckSlide[];
  updatedAt: number;
}

function toRow(r: Record<string, unknown>): DeckRow {
  let slides: DeckSlide[] = [];
  try {
    slides = parseSlides(JSON.parse(String(r.slides_json ?? "[]")));
  } catch {
    slides = [];
  }
  return {
    id: Number(r.id),
    title: String(r.title ?? ""),
    examId: r.exam_id == null ? null : Number(r.exam_id),
    slides,
    updatedAt: Number(r.updated_at),
  };
}

export async function getDeck(id: number): Promise<DeckRow | null> {
  if (!Number.isInteger(id)) return null;
  await ensureDeckTable();
  const r = await db().execute({ sql: "SELECT * FROM exam_decks WHERE id = ?", args: [id] });
  return r.rows[0] ? toRow(r.rows[0] as Record<string, unknown>) : null;
}

export async function listDecks(): Promise<DeckRow[]> {
  await ensureDeckTable();
  const r = await db().execute("SELECT * FROM exam_decks ORDER BY updated_at DESC, id DESC");
  return r.rows.map((x) => toRow(x as Record<string, unknown>));
}

export function blankSlides(): DeckSlide[] {
  return parseSlides([{ title: "", bullets: [], notes: "" }]);
}

export async function createDeck(title: string, examId: number | null, slides: DeckSlide[]): Promise<number> {
  await ensureDeckTable();
  const t = now();
  const r = await db().execute({
    sql: "INSERT INTO exam_decks (title, exam_id, slides_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
    args: [title, examId, JSON.stringify(slides), t, t],
  });
  return Number(r.lastInsertRowid);
}

function isBlank(slides: DeckSlide[]): boolean {
  return slides.every((s) => !s.title.trim() && s.bullets.length === 0);
}

// The exam "Bamidbar 9-16" is recognised by its seed key or by its title (the
// key may be missing on exams that were re-created).
function isSeededExam(exam: { seedKey: string | null; title: string }): boolean {
  return exam.seedKey === "bamidbar-9-14-exam" || exam.title === SEED_EXAM_TITLE;
}

// Opening a deck of the seeded exam that is still empty fills it in.
export async function fillSeedIfEmpty(deck: DeckRow): Promise<DeckRow> {
  if (deck.examId == null || !isBlank(deck.slides)) return deck;
  const exam = await getDoc(deck.examId);
  if (!exam || !isSeededExam(exam)) return deck;
  const slides = parseDeckText(SEED_DECK_TEXT);
  await saveDeck(deck.id, deck.title, slides);
  return { ...deck, slides };
}

// The deck of an exam: the existing one, or a new one. The exam
// "Bamidbar 9-16" starts with the teacher's content, others with one blank slide.
// An existing deck of that exam that is still empty is filled with the content
// (never a second deck, never overwriting a deck that has content).
export async function deckForExam(examId: number): Promise<number | null> {
  await ensureDeckTable();
  const exam = await getDoc(examId);
  if (!exam || exam.kind !== "exam") return null;
  const seeded = isSeededExam(exam);
  const found = await db().execute({
    sql: "SELECT * FROM exam_decks WHERE exam_id = ? ORDER BY id",
    args: [examId],
  });
  if (found.rows.length > 0) {
    const decks = found.rows.map((x) => toRow(x as Record<string, unknown>));
    const withContent = decks.find((d) => !isBlank(d.slides));
    if (withContent) return withContent.id;
    const first = decks[0];
    if (seeded) await saveDeck(first.id, first.title || `מצגת חזרה: ${exam.title || "מבחן"}`, parseDeckText(SEED_DECK_TEXT));
    return first.id;
  }
  const slides = seeded ? parseDeckText(SEED_DECK_TEXT) : blankSlides();
  return createDeck(`מצגת חזרה: ${exam.title || "מבחן"}`, examId, slides);
}

export async function saveDeck(id: number, title: string, slides: DeckSlide[]): Promise<void> {
  await ensureDeckTable();
  await db().execute({
    sql: "UPDATE exam_decks SET title = ?, slides_json = ?, updated_at = ? WHERE id = ?",
    args: [title, JSON.stringify(slides), now(), id],
  });
}

export async function deleteDeck(id: number): Promise<void> {
  await ensureDeckTable();
  await db().execute({ sql: "DELETE FROM exam_decks WHERE id = ?", args: [id] });
}
