import { db } from "./db";
import { ensureExamTables, getDoc, now } from "./exams";
import { deckForExam, getDeck, isSeededExam } from "./decks";
import { newSlideId, parseSlides, type DeckSlide } from "./deck-types";

// The student copy of an exam's review presentation (issue #53). Server-only.
// Canonical DDL: migrations/0022_student_decks.sql (also applied lazily here).

export const STUDENT_DECK_TITLE = "מצגת חזרה — לתלמידים";

let ready = false;
async function ensureTable() {
  if (ready) return;
  await ensureExamTables();
  await db().execute(`CREATE TABLE IF NOT EXISTS exam_student_decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL UNIQUE REFERENCES exam_docs(id),
    title TEXT NOT NULL DEFAULT '',
    slides_json TEXT NOT NULL DEFAULT '[]',
    published INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
  ready = true;
}

export interface StudentDeck {
  id: number;
  examId: number;
  title: string;
  slides: DeckSlide[]; // with speaker notes: teacher use only
  published: boolean;
  updatedAt: number;
}

// What a student may receive: no speaker notes, ever.
export interface PublicSlide {
  id: string;
  title: string;
  bullets: DeckSlide["bullets"];
}

export function publicSlides(slides: DeckSlide[]): PublicSlide[] {
  return slides.map((s) => ({ id: s.id, title: s.title, bullets: s.bullets }));
}

function toRow(r: Record<string, unknown>): StudentDeck {
  let slides: DeckSlide[] = [];
  try {
    slides = parseSlides(JSON.parse(String(r.slides_json ?? "[]")));
  } catch {
    slides = [];
  }
  return {
    id: Number(r.id),
    examId: Number(r.exam_id),
    title: String(r.title ?? ""),
    slides,
    published: Number(r.published) !== 0,
    updatedAt: Number(r.updated_at),
  };
}

async function find(examId: number): Promise<StudentDeck | null> {
  const r = await db().execute({ sql: "SELECT * FROM exam_student_decks WHERE exam_id = ?", args: [examId] });
  return r.rows[0] ? toRow(r.rows[0] as Record<string, unknown>) : null;
}

// A fresh copy of the teacher's slides (new slide ids, same content and notes).
async function copyOfSource(examId: number): Promise<DeckSlide[]> {
  const sourceId = await deckForExam(examId);
  const source = sourceId == null ? null : await getDeck(sourceId);
  return (source?.slides ?? []).map((s) => ({
    ...s,
    id: newSlideId(),
    bullets: s.bullets.map((b) => ({ ...b })),
  }));
}

// The copy of an exam's deck: the existing one, or a new one created exactly
// once (UNIQUE exam_id + INSERT OR IGNORE keep concurrent calls from making
// a second). Null when the exam does not exist or is not an exam.
export async function ensureStudentDeck(examId: number): Promise<StudentDeck | null> {
  if (!Number.isInteger(examId)) return null;
  await ensureTable();
  const existing = await find(examId);
  if (existing) return existing;
  const exam = await getDoc(examId);
  if (!exam || exam.kind !== "exam") return null;
  const slides = await copyOfSource(examId);
  const t = now();
  await db().execute({
    sql: `INSERT OR IGNORE INTO exam_student_decks (exam_id, title, slides_json, published, created_at, updated_at)
          VALUES (?, ?, ?, 1, ?, ?)`,
    args: [examId, STUDENT_DECK_TITLE, JSON.stringify(slides), t, t],
  });
  return find(examId);
}

// The deck a student may see: published and with at least one slide. The copy
// of the seeded exam "Bamidbar 9-16" is created on first need (published by
// default, as the teacher asked); other exams get a copy only when the
// teacher creates it.
export async function getPublicDeck(examId: number): Promise<{ title: string; slides: PublicSlide[] } | null> {
  if (!Number.isInteger(examId)) return null;
  await ensureTable();
  let deck = await find(examId);
  if (!deck) {
    const exam = await getDoc(examId);
    if (!exam || !isSeededExam(exam)) return null;
    deck = await ensureStudentDeck(examId);
  }
  if (!deck || !deck.published || deck.slides.length === 0) return null;
  return { title: deck.title || STUDENT_DECK_TITLE, slides: publicSlides(deck.slides) };
}

export async function saveStudentDeck(examId: number, title: string, slides: DeckSlide[]): Promise<void> {
  await ensureTable();
  await db().execute({
    sql: "UPDATE exam_student_decks SET title = ?, slides_json = ?, updated_at = ? WHERE exam_id = ?",
    args: [title, JSON.stringify(slides), now(), examId],
  });
}

export async function setStudentDeckPublished(examId: number, published: boolean): Promise<void> {
  await ensureTable();
  await db().execute({
    sql: "UPDATE exam_student_decks SET published = ?, updated_at = ? WHERE exam_id = ?",
    args: [published ? 1 : 0, now(), examId],
  });
}

// "עדכון מהמצגת שלי": replaces the copy's slides with a fresh copy of the
// teacher's deck. Returns the new slides.
export async function syncStudentDeck(examId: number): Promise<DeckSlide[]> {
  await ensureTable();
  const slides = await copyOfSource(examId);
  await db().execute({
    sql: "UPDATE exam_student_decks SET slides_json = ?, updated_at = ? WHERE exam_id = ?",
    args: [JSON.stringify(slides), now(), examId],
  });
  return slides;
}
