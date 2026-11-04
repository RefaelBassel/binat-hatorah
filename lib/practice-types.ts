// Client-safe shapes for the students' exam practice area (issue #34):
// quick quiz, flash cards, open-question practice with Claude feedback, and a
// timed sample exam. Server code lives in lib/practice.ts.

import type { ExamBody } from "./exam-types";

export interface Flashcard {
  id: string;
  unitRef: string; // content ref of the unit (e.g. "lesson-05"), "" = general
  front: string;
  back: string;
}

export interface OpenPracticeQuestion {
  id: string;
  unitRef: string; // "" = general
  text: string;
}

// What the teacher sets in the exam editor. cards / openQuestions = null
// means "not edited yet": the automatic defaults are used.
export interface PracticeSettings {
  units: string[]; // content refs, in the order they are shown
  cards: Flashcard[] | null;
  openQuestions: OpenPracticeQuestion[] | null;
}

export interface PracticeUnit {
  ref: string;
  title: string; // short unit name, e.g. "המרגלים"
  chapters: string; // e.g. "חומש במדבר, פרקים י״ג–י״ד"
}

// A quiz question as the browser sees it: no answer key.
export interface QuizQuestion {
  id: string; // "<unitRef>|<check key>"
  unitRef: string;
  kind: "choice" | "truefalse" | "order";
  prompt: string;
  options: string[]; // shuffled (choice / order); empty for truefalse
}

// Student answer: choice = the option TEXT, truefalse = 0 (נכון) / 1 (לא נכון),
// order = the option texts in the chosen order.
export type QuizAnswer = string | number | string[];

export interface QuizVerdict {
  correct: boolean;
  correctAnswer: string | string[];
  part: string;
}

export interface OpenFeedback {
  good: string;
  missing: string;
  hint: string;
}

export interface UnitProgress {
  ref: string;
  title: string;
  activity: number; // practice actions in this unit
  quizAnswered: number;
  quizCorrect: number;
  cardsTotal: number;
  cardsKnown: number;
}

export interface MockExam {
  title: string;
  durationMin: number;
  body: ExamBody;
}

export const OPEN_ANSWER_MAX = 4000;
export const QUIZ_ROUND = 10;

export function quizPct(u: { quizAnswered: number; quizCorrect: number }): number | null {
  return u.quizAnswered === 0 ? null : Math.round((100 * u.quizCorrect) / u.quizAnswered);
}

// The unit most worth reviewing: little practice, weak quiz or many unknown cards.
export function weakestUnit(units: UnitProgress[]): UnitProgress | null {
  if (units.length === 0) return null;
  const score = (u: UnitProgress) => {
    const quiz = quizPct(u) ?? 0;
    const cards = u.cardsTotal === 0 ? quiz : (100 * u.cardsKnown) / u.cardsTotal;
    const effort = Math.min(100, u.activity * 5);
    return quiz * 0.45 + cards * 0.35 + effort * 0.2;
  };
  return [...units].sort((a, b) => score(a) - score(b))[0];
}

export function fmtMinutes(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 1) return seconds > 0 ? "פחות מדקה" : "—";
  if (m < 60) return `${m} דק׳`;
  const h = Math.floor(m / 60);
  return `${h} שע׳ ${m % 60 ? `${m % 60} דק׳` : ""}`.trim();
}
