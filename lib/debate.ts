import { db } from "./db";

// The approved debate format (Rafael, 2026-08-06): adapted Karl Popper —
// substantive Israeli style, no ceremony. Stage list drives the timers on
// the projected board. side: which group speaks (a/b/both/none).
export const DEBATE_STAGES = [
  { key: "open-a", title: "פתיחה", side: "a", seconds: 180, hint: "הטענה המרכזית + 2–3 נימוקים/ראיות" },
  { key: "open-b", title: "פתיחה", side: "b", seconds: 180, hint: "הטענה המרכזית + 2–3 נימוקים/ראיות" },
  { key: "huddle", title: "התייעצות קבוצתית", side: "both", seconds: 120, hint: "מזהים נקודות תורפה: הנחות יסוד? נימוקים? מסקנות?" },
  { key: "rebut-b", title: "הפרכה", side: "b", seconds: 150, hint: "תקיפת הנחות היסוד / הנימוקים / המסקנות של היריבה" },
  { key: "rebut-a", title: "הפרכה", side: "a", seconds: 150, hint: "תקיפת הנחות היסוד / הנימוקים / המסקנות של היריבה" },
  { key: "crossfire", title: "שאלות צולבות", side: "both", seconds: 300, hint: "שיח חופשי וזורם בין הקבוצות" },
  { key: "close-b", title: "סיכום", side: "b", seconds: 120, hint: "למה העמדה שלנו שרדה את ההתקפות" },
  { key: "close-a", title: "סיכום", side: "a", seconds: 120, hint: "למה העמדה שלנו שרדה את ההתקפות" },
  { key: "vote", title: "הצבעת הקהל", side: "none", seconds: 180, hint: "מדרגים בשפת הטיעון — לא רק ״מי ניצח״" },
] as const;

// The four voting axes — the argument-skill language.
export const VOTE_AXES = [
  { key: "ax_reasons", label: "חוזק הנימוקים והראיות" },
  { key: "ax_assumptions", label: "חשיפת הנחות היסוד של היריבה" },
  { key: "ax_logic", label: "הלוגיקה של המסקנות" },
  { key: "ax_rebuttal", label: "המענה להתקפות" },
] as const;

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export interface DebateRow {
  id: number;
  title: string;
  status: string;
  currentQuestionId: number | null;
  currentStage: number;
  stageStartedAt: number | null;
  stageRemaining: number | null;
}

export interface QuestionRow {
  id: number;
  orderIdx: number;
  question: string;
  positionA: string;
  positionB: string;
  groupA: string;
  groupB: string;
  votesOpen: boolean;
  done: boolean;
}

export async function getDebate(id: number): Promise<DebateRow | null> {
  const res = await db().execute({
    sql: `SELECT id, title, status, current_question_id, current_stage, stage_started_at, stage_remaining
          FROM debates WHERE id = ?`,
    args: [id],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    title: String(r.title),
    status: String(r.status),
    currentQuestionId: r.current_question_id != null ? Number(r.current_question_id) : null,
    currentStage: Number(r.current_stage),
    stageStartedAt: r.stage_started_at != null ? Number(r.stage_started_at) : null,
    stageRemaining: r.stage_remaining != null ? Number(r.stage_remaining) : null,
  };
}

export async function getQuestions(debateId: number): Promise<QuestionRow[]> {
  const res = await db().execute({
    sql: `SELECT id, order_idx, question, position_a, position_b, group_a, group_b, votes_open, done
          FROM debate_questions WHERE debate_id = ? ORDER BY order_idx`,
    args: [debateId],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    orderIdx: Number(r.order_idx),
    question: String(r.question),
    positionA: String(r.position_a),
    positionB: String(r.position_b),
    groupA: String(r.group_a),
    groupB: String(r.group_b),
    votesOpen: Boolean(r.votes_open),
    done: Boolean(r.done),
  }));
}

// Aggregated vote results per question: average per axis (-2..2; negative →
// group A stronger) + total + vote count.
export async function questionResults(questionId: number) {
  const res = await db().execute({
    sql: `SELECT COUNT(*) AS n,
                 AVG(ax_reasons) AS reasons, AVG(ax_assumptions) AS assumptions,
                 AVG(ax_logic) AS logic, AVG(ax_rebuttal) AS rebuttal
          FROM debate_votes WHERE question_id = ?`,
    args: [questionId],
  });
  const r = res.rows[0];
  const n = Number(r?.n ?? 0);
  if (n === 0) return { n: 0, axes: [0, 0, 0, 0], total: 0 };
  const axes = [
    Number(r.reasons ?? 0),
    Number(r.assumptions ?? 0),
    Number(r.logic ?? 0),
    Number(r.rebuttal ?? 0),
  ];
  return { n, axes, total: axes.reduce((s, v) => s + v, 0) };
}

export async function allDebates() {
  const res = await db().execute({
    sql: `SELECT d.id, d.title, d.status, d.created_at,
            (SELECT COUNT(*) FROM debate_questions q WHERE q.debate_id = d.id) AS questions
          FROM debates d ORDER BY d.created_at DESC`,
    args: [],
  });
  return res.rows.map((r) => ({
    id: Number(r.id),
    title: String(r.title),
    status: String(r.status),
    createdAt: Number(r.created_at),
    questions: Number(r.questions),
  }));
}
