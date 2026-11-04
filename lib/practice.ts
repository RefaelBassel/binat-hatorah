import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { CLAUDE_MODEL } from "./claude";
import { getAnthropicApiKey } from "./env";
import { examBodyOf, getDoc, now, prepBodyOf, type DocRow } from "./exams";
import { answerItems, fmtPoints, newId, type ExamBody, type ExamPart, type ExamQuestion } from "./exam-types";
import { EXAM_SUMMARY_UNITS, summaryUnitsFor } from "./exam-summary-types";
import { effectiveContent } from "./content-overrides";
import { getTaskContent, isWritingTask } from "@/content/tasks/registry";
import type { CheckQuestion, QuestionIcon, TaskContent } from "@/content/tasks/types";
import {
  OPEN_ANSWER_MAX,
  QUIZ_ROUND,
  type Flashcard,
  type MockExam,
  type OpenFeedback,
  type OpenPracticeQuestion,
  type PracticeSettings,
  type PracticeUnit,
  type QuizAnswer,
  type QuizQuestion,
  type QuizVerdict,
  type UnitProgress,
} from "./practice-types";

// The students' exam practice area (issue #34). Server-only. Settings live on
// the exam row (practice_json, practice_opened_at); every practice action is
// one row of practice_events. Canonical DDL: migrations/0020_exam_practice.sql
// (also applied lazily here). Nothing here feeds the grades report.

const DDL = [
  `CREATE TABLE IF NOT EXISTS practice_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exam_id INTEGER NOT NULL REFERENCES exam_docs(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    unit_ref TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL,
    item_key TEXT NOT NULL DEFAULT '',
    correct INTEGER,
    seconds INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS idx_practice_events_exam ON practice_events(exam_id, user_id)",
];

let ready = false;
export async function ensurePracticeTables() {
  if (ready) return;
  const info = await db().execute("PRAGMA table_info(exam_docs)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("practice_json")) await db().execute("ALTER TABLE exam_docs ADD COLUMN practice_json TEXT");
  if (!cols.has("practice_opened_at")) await db().execute("ALTER TABLE exam_docs ADD COLUMN practice_opened_at INTEGER");
  for (const stmt of DDL) await db().execute(stmt);
  ready = true;
}

// ── Settings ───────────────────────────────────────────────────────────

// Units a practice covers before the teacher chooses, by the exam's seed key.
const DEFAULT_UNITS: Record<string, string[]> = {
  "bamidbar-9-14-exam": ["lesson-01", "lesson-02", "lesson-03", "lesson-04", "lesson-05", "lesson-07"],
};

function defaultUnits(exam: DocRow): string[] {
  if (exam.seedKey && DEFAULT_UNITS[exam.seedKey]) return DEFAULT_UNITS[exam.seedKey];
  // the Bamidbar exam re-created by hand (not the seeded row) gets the same default
  if (/במדבר/.test(exam.title)) return DEFAULT_UNITS["bamidbar-9-14-exam"];
  return summaryUnitsFor(exam.seedKey).map((u) => u.taskRef);
}

export interface PracticeState {
  exam: DocRow;
  settings: PracticeSettings;
  openedAt: number | null;
}

export async function getPracticeState(examId: number): Promise<PracticeState | null> {
  await ensurePracticeTables();
  const exam = await getDoc(examId);
  if (!exam || exam.kind !== "exam") return null;
  const res = await db().execute({
    sql: "SELECT practice_json, practice_opened_at FROM exam_docs WHERE id = ?",
    args: [examId],
  });
  const r = res.rows[0];
  let saved: Partial<PracticeSettings> = {};
  try {
    if (r?.practice_json) saved = JSON.parse(String(r.practice_json));
  } catch {}
  const settings: PracticeSettings = {
    units: Array.isArray(saved.units) ? saved.units.filter((u) => getTaskContent(String(u))) : defaultUnits(exam),
    cards: Array.isArray(saved.cards) ? saved.cards : null,
    openQuestions: Array.isArray(saved.openQuestions) ? saved.openQuestions : null,
  };
  return { exam, settings, openedAt: r?.practice_opened_at == null ? null : Number(r.practice_opened_at) };
}

export async function savePracticeSettings(examId: number, settings: PracticeSettings) {
  await ensurePracticeTables();
  await db().execute({
    sql: "UPDATE exam_docs SET practice_json = ? WHERE id = ? AND kind = 'exam'",
    args: [JSON.stringify(settings), examId],
  });
}

export async function setPracticeOpen(examId: number, open: boolean) {
  await ensurePracticeTables();
  await db().execute({
    sql: "UPDATE exam_docs SET practice_opened_at = ? WHERE id = ? AND kind = 'exam'",
    args: [open ? now() : null, examId],
  });
}

// Exams whose practice is open to students (for /tasks and the menu).
export async function openPractices(): Promise<{ id: number; title: string }[]> {
  await ensurePracticeTables();
  const res = await db().execute(
    "SELECT id, title FROM exam_docs WHERE kind = 'exam' AND practice_opened_at IS NOT NULL ORDER BY practice_opened_at DESC"
  );
  return res.rows.map((r) => ({ id: Number(r.id), title: String(r.title ?? "") }));
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function sanitizeSettings(raw: unknown): PracticeSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.units)) return null;
  const units = [...new Set(o.units.map((u) => String(u)))].filter((u) => {
    const reg = getTaskContent(u);
    return reg != null && !isWritingTask(reg.content);
  });
  const cards =
    o.cards == null
      ? null
      : Array.isArray(o.cards)
        ? o.cards
            .slice(0, 300)
            .map((c) => {
              const x = (c ?? {}) as Record<string, unknown>;
              return {
                id: str(x.id, 60) || newId(),
                unitRef: str(x.unitRef, 40),
                front: str(x.front, 600),
                back: str(x.back, 1200),
              };
            })
            .filter((c) => c.front !== "" || c.back !== "")
        : null;
  const openQuestions =
    o.openQuestions == null
      ? null
      : Array.isArray(o.openQuestions)
        ? o.openQuestions
            .slice(0, 100)
            .map((q) => {
              const x = (q ?? {}) as Record<string, unknown>;
              return { id: str(x.id, 60) || newId(), unitRef: str(x.unitRef, 40), text: str(x.text, 1500) };
            })
            .filter((q) => q.text !== "")
        : null;
  return { units, cards, openQuestions };
}

// ── Units and their content ────────────────────────────────────────────

export function unitTitle(ref: string, content?: TaskContent): string {
  for (const units of Object.values(EXAM_SUMMARY_UNITS)) {
    const hit = units.find((u) => u.taskRef === ref);
    if (hit) return hit.title;
  }
  const c = content ?? getTaskContent(ref)?.content;
  if (!c) return ref;
  const parts = c.title.split("—");
  return (parts[parts.length - 1] ?? c.title).trim() || c.title;
}

export function practiceUnits(refs: string[]): PracticeUnit[] {
  const out: PracticeUnit[] = [];
  for (const ref of refs) {
    const reg = getTaskContent(ref);
    if (!reg || isWritingTask(reg.content)) continue;
    out.push({ ref, title: unitTitle(ref, reg.content), chapters: reg.content.bookRef });
  }
  return out;
}

// Units a teacher may pick from in the editor: every chapter unit.
export function allChapterUnits(): PracticeUnit[] {
  const refs: string[] = [];
  for (let i = 1; i <= 99; i++) {
    const ref = `lesson-${String(i).padStart(2, "0")}`;
    if (getTaskContent(ref)) refs.push(ref);
  }
  return practiceUnits(refs);
}

async function unitContent(ref: string): Promise<TaskContent | null> {
  const reg = getTaskContent(ref);
  if (!reg || isWritingTask(reg.content)) return null;
  return effectiveContent(reg.content);
}

function excerpt(text: string, words = 28): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const sentence = clean.split(/(?<=[.:!?])\s/)[0] ?? clean;
  const w = sentence.split(" ");
  return w.length > words ? `${w.slice(0, words).join(" ")}…` : sentence;
}

// Automatic flash cards: one per commentary source in each unit.
export async function autoCards(units: string[]): Promise<Flashcard[]> {
  const out: Flashcard[] = [];
  for (const ref of units) {
    const content = await unitContent(ref);
    if (!content) continue;
    const seen = new Set<string>();
    for (const s of content.sections) {
      for (const b of s.blocks) {
        if (b.type !== "source" || seen.has(b.title)) continue;
        seen.add(b.title);
        out.push({ id: `auto-${ref}-${b.key}`, unitRef: ref, front: `${b.title} — מה הוא אומר?`, back: excerpt(b.text) });
      }
    }
  }
  return out;
}

// Automatic open questions: the prep sheet's practice questions, then the
// units' own argument-skill questions.
export async function autoOpenQuestions(exam: DocRow, units: string[]): Promise<OpenPracticeQuestion[]> {
  const out: OpenPracticeQuestion[] = [];
  const prep = exam.prepId != null ? await getDoc(exam.prepId) : null;
  if (prep) {
    const blocks = prepBodyOf(prep).blocks;
    let inPractice = false;
    for (const b of blocks) {
      if (b.type === "heading") {
        inPractice = b.text.includes("תרגול");
        continue;
      }
      if (inPractice && (b.type === "numbered" || b.type === "bullets")) {
        b.items.forEach((it, i) => it.trim() && out.push({ id: `prep-${b.id}-${i}`, unitRef: "", text: it.trim() }));
      }
    }
  }
  for (const ref of units) {
    const content = await unitContent(ref);
    if (!content) continue;
    let n = 0;
    for (const s of content.sections) {
      for (const b of s.blocks) {
        if (b.type === "question" && b.icon === "argument" && n < 2) {
          out.push({ id: `arg-${ref}-${b.key}`, unitRef: ref, text: b.prompt });
          n++;
        }
      }
    }
  }
  return out;
}

export async function effectiveCards(state: PracticeState): Promise<Flashcard[]> {
  const cards = state.settings.cards ?? (await autoCards(state.settings.units));
  return cards.filter((c) => c.unitRef === "" || state.settings.units.includes(c.unitRef));
}

export async function effectiveOpenQuestions(state: PracticeState): Promise<OpenPracticeQuestion[]> {
  const qs = state.settings.openQuestions ?? (await autoOpenQuestions(state.exam, state.settings.units));
  return qs.filter((q) => q.unitRef === "" || state.settings.units.includes(q.unitRef));
}

// ── Quick quiz ─────────────────────────────────────────────────────────

interface PoolItem {
  id: string;
  unitRef: string;
  q: CheckQuestion;
}

export async function quizPool(units: string[]): Promise<PoolItem[]> {
  const out: PoolItem[] = [];
  for (const ref of units) {
    const content = await unitContent(ref);
    for (const q of content?.check ?? []) {
      if (q.kind === "choice" && q.options.length < 2) continue;
      if (q.kind === "order" && q.options.length < 2) continue;
      out.push({ id: `${ref}|${q.key}`, unitRef: ref, q });
    }
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function toPublic(p: PoolItem): QuizQuestion {
  const { q } = p;
  let options: string[] = [];
  if (q.kind === "choice") options = shuffle(q.options);
  if (q.kind === "order") {
    options = shuffle(q.options);
    if (options.every((v, i) => v === q.options[i])) options = [...options.slice(1), options[0]];
  }
  return { id: p.id, unitRef: p.unitRef, kind: q.kind, prompt: q.prompt, options };
}

export function quizRound(pool: PoolItem[], unit: string, only: string[] | null): QuizQuestion[] {
  let items = pool;
  if (only && only.length > 0) items = items.filter((p) => only.includes(p.id));
  else if (unit !== "all") items = items.filter((p) => p.unitRef === unit);
  return shuffle(items).slice(0, QUIZ_ROUND).map(toPublic);
}

export function judgeQuiz(item: PoolItem, answer: QuizAnswer): QuizVerdict {
  const { q } = item;
  let correct = false;
  let correctAnswer: string | string[] = "";
  if (q.kind === "choice") {
    correctAnswer = q.options[q.answer] ?? "";
    correct = typeof answer === "string" && answer === correctAnswer;
  } else if (q.kind === "truefalse") {
    correctAnswer = q.answer === 0 ? "נכון" : "לא נכון";
    correct = typeof answer === "number" && answer === q.answer;
  } else {
    correctAnswer = q.options;
    correct = Array.isArray(answer) && answer.length === q.options.length && answer.every((t, i) => t === q.options[i]);
  }
  return { correct, correctAnswer, part: q.part };
}

// ── Events and progress ────────────────────────────────────────────────

export type EventKind = "quiz" | "card" | "open" | "mock";

export async function recordEvent(e: {
  examId: number;
  userId: number;
  unitRef: string;
  kind: EventKind;
  itemKey: string;
  correct: boolean | null;
  seconds: number;
}) {
  await ensurePracticeTables();
  await db().execute({
    sql: `INSERT INTO practice_events (exam_id, user_id, unit_ref, kind, item_key, correct, seconds, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      e.examId,
      e.userId,
      e.unitRef.slice(0, 40),
      e.kind,
      e.itemKey.slice(0, 120),
      e.correct == null ? null : e.correct ? 1 : 0,
      Math.max(0, Math.min(e.kind === "mock" ? 4 * 3600 : 600, Math.round(e.seconds) || 0)),
      now(),
    ],
  });
}

// Card id -> known? (the latest mark wins)
export async function cardMarks(examId: number, userId: number): Promise<Record<string, boolean>> {
  await ensurePracticeTables();
  const res = await db().execute({
    sql: "SELECT item_key, correct FROM practice_events WHERE exam_id = ? AND user_id = ? AND kind = 'card' ORDER BY id",
    args: [examId, userId],
  });
  const out: Record<string, boolean> = {};
  for (const r of res.rows) out[String(r.item_key)] = Number(r.correct) === 1;
  return out;
}

export async function studentProgress(
  state: PracticeState,
  userId: number,
  cards: Flashcard[]
): Promise<UnitProgress[]> {
  await ensurePracticeTables();
  const res = await db().execute({
    sql: `SELECT unit_ref, kind, COUNT(*) AS n, SUM(correct = 1) AS ok
          FROM practice_events WHERE exam_id = ? AND user_id = ? GROUP BY unit_ref, kind`,
    args: [state.exam.id, userId],
  });
  const marks = await cardMarks(state.exam.id, userId);
  return practiceUnits(state.settings.units).map((u) => {
    const rows = res.rows.filter((r) => String(r.unit_ref) === u.ref);
    const quiz = rows.find((r) => r.kind === "quiz");
    const unitCards = cards.filter((c) => c.unitRef === u.ref);
    return {
      ref: u.ref,
      title: u.title,
      activity: rows.reduce((s, r) => s + Number(r.n), 0),
      quizAnswered: quiz ? Number(quiz.n) : 0,
      quizCorrect: quiz ? Number(quiz.ok ?? 0) : 0,
      cardsTotal: unitCards.length,
      cardsKnown: unitCards.filter((c) => marks[c.id]).length,
    };
  });
}

// ── Teacher view ───────────────────────────────────────────────────────

export interface StudentPracticeRow {
  userId: number;
  name: string;
  seconds: number;
  actions: number;
  quizAnswered: number;
  quizCorrect: number;
  units: string[]; // unit titles practiced
  lastAt: number;
}

export interface MissedQuestion {
  id: string;
  unitTitle: string;
  prompt: string;
  part: string;
  wrong: number;
  answered: number;
}

export async function classPractice(state: PracticeState): Promise<{ students: StudentPracticeRow[]; missed: MissedQuestion[] }> {
  await ensurePracticeTables();
  const res = await db().execute({
    sql: `SELECT e.user_id, e.unit_ref, e.kind, e.item_key, e.correct, e.seconds, e.created_at, u.full_name, u.email
          FROM practice_events e JOIN users u ON u.id = e.user_id
          WHERE e.exam_id = ? AND u.role = 'student'`,
    args: [state.exam.id],
  });
  const titles = new Map(practiceUnits(state.settings.units).map((u) => [u.ref, u.title]));
  const byUser = new Map<number, StudentPracticeRow & { unitSet: Set<string> }>();
  const byQ = new Map<string, { wrong: number; answered: number }>();
  for (const r of res.rows) {
    const uid = Number(r.user_id);
    let s = byUser.get(uid);
    if (!s) {
      s = {
        userId: uid,
        name: (r.full_name as string | null) ?? String(r.email),
        seconds: 0,
        actions: 0,
        quizAnswered: 0,
        quizCorrect: 0,
        units: [],
        lastAt: 0,
        unitSet: new Set(),
      };
      byUser.set(uid, s);
    }
    s.seconds += Number(r.seconds ?? 0);
    s.actions += 1;
    s.lastAt = Math.max(s.lastAt, Number(r.created_at));
    const ref = String(r.unit_ref ?? "");
    if (ref && titles.has(ref)) s.unitSet.add(ref);
    if (r.kind === "quiz") {
      s.quizAnswered += 1;
      const ok = Number(r.correct) === 1;
      if (ok) s.quizCorrect += 1;
      const key = String(r.item_key);
      const agg = byQ.get(key) ?? { wrong: 0, answered: 0 };
      agg.answered += 1;
      if (!ok) agg.wrong += 1;
      byQ.set(key, agg);
    }
  }
  const students = [...byUser.values()]
    .map(({ unitSet, ...s }) => ({
      ...s,
      units: state.settings.units.filter((u) => unitSet.has(u)).map((u) => titles.get(u) ?? u),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const pool = await quizPool(state.settings.units);
  const poolById = new Map(pool.map((p) => [p.id, p]));
  const missed: MissedQuestion[] = [...byQ.entries()]
    .filter(([id, a]) => a.wrong > 0 && poolById.has(id))
    .map(([id, a]) => {
      const p = poolById.get(id)!;
      return { id, unitTitle: titles.get(p.unitRef) ?? p.unitRef, prompt: p.q.prompt, part: p.q.part, ...a };
    })
    .sort((a, b) => b.wrong / b.answered - a.wrong / a.answered || b.wrong - a.wrong)
    .slice(0, 10);
  return { students, missed };
}

// ── Sample exam ────────────────────────────────────────────────────────

interface BankItem {
  unitRef: string;
  key: string;
  prompt: string;
  icon: QuestionIcon;
}

async function questionBank(units: string[]): Promise<BankItem[]> {
  const out: BankItem[] = [];
  for (const ref of units) {
    const content = await unitContent(ref);
    if (!content) continue;
    for (const s of content.sections) {
      for (const b of s.blocks) {
        if (b.type === "question" && b.prompt.trim()) out.push({ unitRef: ref, key: b.key, prompt: b.prompt, icon: b.icon });
      }
    }
  }
  return out;
}

// Same structure as the real exam (parts, points, "choose N"), but every
// question is drawn from the units' question bank.
export async function buildMockExam(state: PracticeState): Promise<MockExam | null> {
  const real = examBodyOf(state.exam);
  const bank = await questionBank(state.settings.units);
  if (bank.length === 0 || real.parts.length === 0) return null;
  const realTexts = new Set(
    real.parts.flatMap((p) => p.questions.flatMap((q) => [q.text.trim(), ...q.subs.map((s) => s.text.trim())]))
  );
  const used = new Set<string>();
  const titles = new Map(practiceUnits(state.settings.units).map((u) => [u.ref, u.title]));
  const fresh = (b: BankItem) => !used.has(`${b.unitRef}|${b.key}`) && !realTexts.has(b.prompt.trim());
  const take = (pool: BankItem[], n: number): BankItem[] => {
    const picked = shuffle(pool.filter(fresh)).slice(0, n);
    picked.forEach((b) => used.add(`${b.unitRef}|${b.key}`));
    return picked;
  };
  const unitOrder = shuffle(state.settings.units.filter((u) => bank.some((b) => b.unitRef === u)));
  let unitCursor = 0;

  const parts: ExamPart[] = real.parts.map((p) => {
    const kind = /כתיב/.test(p.title) ? "writing" : /טיעון/.test(p.title) ? "argument" : "knowledge";
    const questions: ExamQuestion[] = p.questions.map((rq) => {
      const nSubs = Math.max(1, rq.subs.length);
      let picked: BankItem[] = [];
      let text = rq.text;
      if (kind === "knowledge") {
        // one unit per question, like "פסח שני (פרק ט׳)"
        for (let tries = 0; tries < unitOrder.length && picked.length === 0; tries++) {
          const ref = unitOrder[unitCursor++ % unitOrder.length];
          const inUnit = bank.filter((b) => b.unitRef === ref);
          const preferred = inUnit.filter((b) => b.icon === "reading" || b.icon === "thinking");
          picked = take(preferred.length >= nSubs ? preferred : inUnit, nSubs);
          if (picked.length) text = `${titles.get(ref) ?? ""} (${getTaskContent(ref)?.content.bookRef ?? ""})`;
        }
      } else if (kind === "argument") {
        const pool = bank.filter((b) => b.icon === "argument");
        picked = take(pool.length >= nSubs ? pool : bank, nSubs);
        text = picked[0] ? `${titles.get(picked[0].unitRef) ?? ""}` : "";
      } else {
        const pool = bank.filter((b) => b.icon !== "reading");
        picked = take(pool.length >= nSubs ? pool : bank, nSubs);
      }
      if (picked.length === 0) picked = take(bank, nSubs);
      const subs =
        rq.subs.length === 0
          ? []
          : picked.map((b) => ({ id: newId(), text: b.prompt, points: null, rubric: "" }));
      return {
        id: newId(),
        text: rq.subs.length === 0 ? (picked[0]?.prompt ?? text) : text,
        points: rq.points ?? (rq.subs.length ? rq.subs.reduce((s, x) => s + (x.points ?? 0), 0) || null : null),
        rubric: "",
        subs,
        chooseSubs: rq.chooseSubs ?? null,
        footer: rq.footer,
      };
    });
    return { id: newId(), title: p.title, instructions: p.instructions, points: p.points, choose: p.choose, questions };
  });
  return { title: `מבחן לדוגמה: ${state.exam.title.replace(/^מבחן:\s*/, "")}`, durationMin: state.exam.durationMin ?? 90, body: { parts } };
}

// ── Claude ─────────────────────────────────────────────────────────────

function client(): Anthropic {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error("המשוב האוטומטי לא זמין כרגע.");
  return new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
}

const FEEDBACK_SYSTEM = `את/ה מלווה לימודי/ת באתר "בינת התורה" (תנ"ך, חומש במדבר, כיתה י, תיכון שחרית).
תלמידה מתרגלת לקראת מבחן ועונה על שאלה. תני משוב קצר, חם ומעודד, בגובה העיניים, בלי ציון ובלי מספרים:
- good: מה טוב בתשובה (משפט אחד או שניים).
- missing: מה חסר או לא מדויק (משפט אחד או שניים). אם התשובה מלאה, כתבי זאת.
- hint: רמז אחד לשיפור, שמכוון לפסוק, לפרשן או למושג (טענה / נימוק / הנחת יסוד / הפרכה) בלי לכתוב את התשובה המלאה.
אם התשובה ריקה או לא קשורה, אמרי זאת בעדינות ותני רמז להתחלה. טקסט רגיל בלבד, בלי Markdown.`;

function feedbackTool(withKey: boolean) {
  const item = {
    type: "object" as const,
    properties: {
      ...(withKey ? { key: { type: "string" } } : {}),
      good: { type: "string" },
      missing: { type: "string" },
      hint: { type: "string" },
    },
    required: [...(withKey ? ["key"] : []), "good", "missing", "hint"],
    additionalProperties: false,
  };
  return item;
}

function pickTool<T>(msg: Anthropic.Message): T {
  const t = msg.content.find((c) => c.type === "tool_use");
  if (!t || t.type !== "tool_use") throw new Error("לא התקבל משוב. אפשר לנסות שוב.");
  return (t.input ?? {}) as T;
}

function asFeedback(o: Record<string, unknown>): OpenFeedback {
  return { good: String(o.good ?? ""), missing: String(o.missing ?? ""), hint: String(o.hint ?? "") };
}

export async function openQuestionFeedback(
  question: string,
  answer: string,
  context: string
): Promise<OpenFeedback> {
  const msg = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: FEEDBACK_SYSTEM,
    tools: [{ name: "submit_feedback", description: "הגשת המשוב לתלמידה", input_schema: feedbackTool(false) }],
    tool_choice: { type: "tool", name: "submit_feedback" },
    messages: [
      {
        role: "user",
        content: `${context ? `ההקשר: ${context}\n` : ""}השאלה: ${question}\n\nהתשובה של התלמידה:\n${answer.slice(0, OPEN_ANSWER_MAX)}`,
      },
    ],
  });
  return asFeedback(pickTool<Record<string, unknown>>(msg));
}

export async function mockExamFeedback(
  title: string,
  body: ExamBody,
  answers: Record<string, string>
): Promise<Record<string, OpenFeedback>> {
  const items = answerItems(body).filter((it) => (answers[it.key] ?? "").trim() !== "");
  if (items.length === 0) return {};
  const qa = items.map(
    (it) =>
      `[מזהה: ${it.key}] ${it.label} (${fmtPoints(it.maxPoints)} נק׳)\nשאלה: ${it.questionText}${
        it.prompt !== it.questionText ? `\nסעיף: ${it.prompt}` : ""
      }\nהתשובה: ${(answers[it.key] ?? "").slice(0, OPEN_ANSWER_MAX)}`
  );
  const msg = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: `${FEEDBACK_SYSTEM}\nזה מבחן לדוגמה לתרגול בלבד: תני משוב כזה לכל תשובה ברשימה, לפי המזהה שלה, דרך הכלי submit_feedback.`,
    tools: [
      {
        name: "submit_feedback",
        description: "הגשת המשוב לכל התשובות",
        input_schema: {
          type: "object" as const,
          properties: { answers: { type: "array", items: feedbackTool(true) } },
          required: ["answers"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_feedback" },
    messages: [{ role: "user", content: `${title}\n\n${qa.join("\n\n")}` }],
  });
  const input = pickTool<{ answers?: unknown }>(msg);
  const keys = new Set(items.map((it) => it.key));
  const out: Record<string, OpenFeedback> = {};
  if (Array.isArray(input.answers)) {
    for (const a of input.answers) {
      const o = (a ?? {}) as Record<string, unknown>;
      const key = String(o.key ?? "");
      if (keys.has(key)) out[key] = asFeedback(o);
    }
  }
  return out;
}

// Teacher: Claude drafts flash cards from the units' commentary sources —
// one sentence of gist per source and one key verse per unit. The teacher
// edits them before saving.
export async function suggestCards(units: string[]): Promise<Flashcard[]> {
  const parts: string[] = [];
  for (const ref of units) {
    const content = await unitContent(ref);
    if (!content) continue;
    const sources: string[] = [];
    for (const s of content.sections) {
      for (const b of s.blocks) {
        if (b.type === "source") sources.push(`- ${b.title}: ${b.text.slice(0, 1200)}`);
      }
    }
    const main = content.sections
      .flatMap((s) => s.blocks)
      .find((b) => b.type === "passage" && b.decode);
    const verses =
      main && main.type === "passage"
        ? main.verses
            .slice(0, 40)
            .map((v) => `${v.num}. ${v.text}`)
            .join("\n")
        : "";
    parts.push(
      `[יחידה ${ref}] ${unitTitle(ref, content)} — ${content.bookRef}\nמקורות:\n${sources.join("\n") || "(אין)"}\nפסוקי הפרק (${main && main.type === "passage" ? main.ref : ""}):\n${verses}`
    );
  }
  if (parts.length === 0) return [];
  const msg = await client().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: `את/ה עוזר/ת למורה לתנ"ך בכיתה י. הכן/י כרטיסיות זיכרון לתרגול לפני מבחן.
לכל מקור פרשני ביחידה: כרטיס אחד. front: "<שם הפרשן ומקומו, כפי שמופיע בכותרת> — מה הוא אומר?". back: עיקר דבריו במשפט אחד ברור.
בנוסף, לכל יחידה כרטיס אחד או שניים של פסוק מפתח: front: הפסוק המרכזי (מילותיו, בציטוט) ושאלה "איפה זה נאמר ומה המשמעות?". back: המקום והמשמעות במשפט אחד.
עברית תקנית, טקסט רגיל בלי Markdown. הגש/י דרך הכלי submit_cards, עם unitRef מתוך הרשימה.`,
    tools: [
      {
        name: "submit_cards",
        description: "הגשת הכרטיסיות",
        input_schema: {
          type: "object" as const,
          properties: {
            cards: {
              type: "array",
              items: {
                type: "object",
                properties: { unitRef: { type: "string" }, front: { type: "string" }, back: { type: "string" } },
                required: ["unitRef", "front", "back"],
                additionalProperties: false,
              },
            },
          },
          required: ["cards"],
          additionalProperties: false,
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_cards" },
    messages: [{ role: "user", content: parts.join("\n\n") }],
  });
  const input = pickTool<{ cards?: unknown }>(msg);
  if (!Array.isArray(input.cards)) return [];
  return input.cards
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        id: newId(),
        unitRef: units.includes(String(o.unitRef)) ? String(o.unitRef) : "",
        front: String(o.front ?? "").trim(),
        back: String(o.back ?? "").trim(),
      };
    })
    .filter((c) => c.front && c.back);
}
