import { db } from "./db";
import type { CheckQuestion } from "@/content/tasks/types";

// The comprehension check: one attempt per student per task, scored on the
// server against the content's answer key. The answer key is never sent to
// the browser. Results feed the class "understanding pulse" and the closing
// screen; they are NOT the task grade.

let ready = false;
export async function ensureCheckTable() {
  if (ready) return;
  await db().execute(
    `CREATE TABLE IF NOT EXISTS check_results (
       task_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       score INTEGER NOT NULL,        -- 0-10
       correct INTEGER NOT NULL,
       total INTEGER NOT NULL,
       answers_json TEXT NOT NULL,    -- {key: {correct: bool, part}}
       open_answer TEXT,
       submitted_at INTEGER NOT NULL,
       PRIMARY KEY (task_id, user_id)
     )`
  );
  ready = true;
}

// What the student submits: per question key, the chosen option index
// (choice/truefalse) or the chosen order as the option TEXTS (order) — the
// browser only ever sees shuffled texts, never the correct indexes.
export type CheckSubmission = Record<string, number | string[]>;

// The question as the browser may see it: no answer key, and order options
// pre-shuffled on the server (a fixed shuffle so a re-render is stable).
export type PublicCheckQuestion = Omit<CheckQuestion, "answer">;

export function publicCheck(questions: CheckQuestion[], seed: number): PublicCheckQuestion[] {
  return questions.map((q) => {
    const { answer: _answer, ...rest } = q;
    void _answer;
    if (q.kind !== "order") return rest;
    return { ...rest, options: seededShuffle(q.options, seed + hashKey(q.key)) };
  });
}

function hashKey(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

// small LCG so the shuffle is deterministic per (student, task, question)
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr];
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  // never hand back the correct order by chance (that would be a free point)
  if (out.length > 1 && out.every((v, i) => v === arr[i])) {
    [out[0], out[1]] = [out[1], out[0]];
  }
  return out;
}

export interface CheckOutcome {
  score: number;
  correct: number;
  total: number;
  // per question: right or wrong — the correct answer itself is NOT returned
  results: Record<string, boolean>;
}

export function scoreCheck(questions: CheckQuestion[], given: CheckSubmission): CheckOutcome {
  const results: Record<string, boolean> = {};
  let correct = 0;
  for (const q of questions) {
    const g = given[q.key];
    let ok = false;
    if (q.kind === "order") {
      ok =
        Array.isArray(g) &&
        g.length === q.options.length &&
        g.every((text, i) => text === q.options[i]);
    } else {
      ok = typeof g === "number" && g === q.answer;
    }
    results[q.key] = ok;
    if (ok) correct += 1;
  }
  const total = questions.length;
  const score = total === 0 ? 0 : Math.round((10 * correct) / total);
  return { score, correct, total, results };
}

export interface CheckResultRow {
  score: number;
  correct: number;
  total: number;
  results: Record<string, { correct: boolean; part: string }>;
  openAnswer: string | null;
  submittedAt: number;
}

export async function getCheckResult(
  taskId: number,
  userId: number
): Promise<CheckResultRow | null> {
  await ensureCheckTable();
  const res = await db().execute({
    sql: `SELECT score, correct, total, answers_json, open_answer, submitted_at
          FROM check_results WHERE task_id = ? AND user_id = ?`,
    args: [taskId, userId],
  });
  const r = res.rows[0];
  if (!r) return null;
  let results: CheckResultRow["results"] = {};
  try {
    results = JSON.parse(String(r.answers_json));
  } catch {
    /* keep empty */
  }
  return {
    score: Number(r.score),
    correct: Number(r.correct),
    total: Number(r.total),
    results,
    openAnswer: r.open_answer != null ? String(r.open_answer) : null,
    submittedAt: Number(r.submitted_at),
  };
}

// Records the one attempt. Returns null when an attempt already exists.
export async function saveCheckResult(
  taskId: number,
  userId: number,
  questions: CheckQuestion[],
  given: CheckSubmission,
  openAnswer: string | null
): Promise<CheckOutcome | null> {
  await ensureCheckTable();
  if (await getCheckResult(taskId, userId)) return null;
  const outcome = scoreCheck(questions, given);
  const stored: CheckResultRow["results"] = {};
  for (const q of questions) {
    stored[q.key] = { correct: outcome.results[q.key], part: q.part };
  }
  await db().execute({
    sql: `INSERT INTO check_results
            (task_id, user_id, score, correct, total, answers_json, open_answer, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      taskId,
      userId,
      outcome.score,
      outcome.correct,
      outcome.total,
      JSON.stringify(stored),
      openAnswer,
      Math.floor(Date.now() / 1000),
    ],
  });
  return outcome;
}

// Teacher reset of a task also clears the attempt (so "experience it again"
// can run the check again).
export async function clearCheckResult(taskId: number, userId: number) {
  await ensureCheckTable();
  await db().execute({
    sql: "DELETE FROM check_results WHERE task_id = ? AND user_id = ?",
    args: [taskId, userId],
  });
}

// ---------- class aggregation for the pulse / closing screen ----------

export interface WeakSpot {
  part: string;
  wrong: number;
  answered: number;
  wrongPct: number; // 0-100
}

export interface ClassCheckPicture {
  scores: Map<number, number>; // user id -> 0-10
  average: number | null;
  weakSpots: WeakSpot[]; // sorted hardest first
}

export async function classCheckPicture(taskId: number): Promise<ClassCheckPicture> {
  await ensureCheckTable();
  const res = await db().execute({
    sql: "SELECT user_id, score, answers_json FROM check_results WHERE task_id = ?",
    args: [taskId],
  });
  const scores = new Map<number, number>();
  const byPart = new Map<string, { wrong: number; answered: number }>();
  for (const r of res.rows) {
    scores.set(Number(r.user_id), Number(r.score));
    let parsed: Record<string, { correct: boolean; part: string }> = {};
    try {
      parsed = JSON.parse(String(r.answers_json));
    } catch {
      continue;
    }
    for (const v of Object.values(parsed)) {
      const part = v.part || "כללי";
      const agg = byPart.get(part) ?? { wrong: 0, answered: 0 };
      agg.answered += 1;
      if (!v.correct) agg.wrong += 1;
      byPart.set(part, agg);
    }
  }
  const all = [...scores.values()];
  const average =
    all.length === 0 ? null : Math.round((10 * all.reduce((a, b) => a + b, 0)) / all.length) / 10;
  const weakSpots: WeakSpot[] = [...byPart.entries()]
    .map(([part, a]) => ({
      part,
      wrong: a.wrong,
      answered: a.answered,
      wrongPct: a.answered === 0 ? 0 : Math.round((100 * a.wrong) / a.answered),
    }))
    .sort((a, b) => b.wrongPct - a.wrongPct);
  return { scores, average, weakSpots };
}
