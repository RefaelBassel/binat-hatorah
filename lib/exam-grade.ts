import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { CLAUDE_MODEL } from "./claude";
import { getAnthropicApiKey } from "./env";
import { answerItems, scoreFromItems } from "./exam-types";
import { examBodyOf, getAttempt, getDoc, now } from "./exams";
import { notifyStudent } from "./notify";

// Automatic scoring proposal for an exam attempt (issue #25): points per
// answer according to the teacher's marking guide (or, when she left it
// empty, by the model's own reading of the question). The teacher edits the
// numbers and approves; only then does the student see a score.

export type PointsMap = Record<string, { points: number; note: string }>;

export async function proposeExamScore(examId: number, userId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await runProposal(examId, userId);
    return { ok: true };
  } catch (err) {
    console.error("exam grade proposal failed", { examId, userId, err });
    const msg =
      err instanceof Anthropic.APIError
        ? `הבדיקה האוטומטית נכשלה (שגיאה ${err.status ?? ""}). אפשר לנסות שוב.`
        : err instanceof Error && err.message
          ? err.message
          : "הבדיקה האוטומטית נכשלה. אפשר לנסות שוב.";
    await db().execute({
      sql: "UPDATE exam_attempts SET claude_error = ?, updated_at = ? WHERE exam_id = ? AND user_id = ?",
      args: [msg, now(), examId, userId],
    });
    return { ok: false, error: msg };
  }
}

async function runProposal(examId: number, userId: number) {
  const exam = await getDoc(examId);
  const attempt = await getAttempt(examId, userId);
  if (!exam || !attempt) throw new Error("המבחן או ההגשה לא נמצאו.");
  const body = examBodyOf(exam);
  const items = answerItems(body);
  const answered = items.filter((it) => (attempt.answers[it.key] ?? "").trim().length > 0);

  const points: PointsMap = {};
  for (const it of items) points[it.key] = { points: 0, note: answered.includes(it) ? "" : "לא נענה" };

  let feedback = "";
  if (answered.length > 0) {
    const apiKey = getAnthropicApiKey();
    if (!apiKey) throw new Error("אין מפתח API לבדיקה האוטומטית. יש לפנות לרפאל.");
    const client = new Anthropic({ apiKey, timeout: 120_000, maxRetries: 2 });
    const qa = answered.map(
      (it) =>
        `[מזהה: ${it.key}] ${it.label} (עד ${it.maxPoints} נקודות)\nשאלה: ${it.questionText}${
          it.prompt !== it.questionText ? `\nסעיף: ${it.prompt}` : ""
        }\nמחוון / תשובה לדוגמה: ${it.rubric.trim() || "(אין מחוון — יש לבדוק לפי הבנת השאלה והחומר)"}\nתשובת התלמיד/ה: ${attempt.answers[it.key]}`
    );
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system: `את/ה עוזר/ת בדיקה למורה באתר "בינת התורה" (תנ"ך, כיתה י, תיכון שחרית). לפניך תשובות של תלמיד/ה במבחן.
לכל תשובה הצע/י ניקוד מספרי בין 0 לניקוד המרבי שלה, לפי המחוון כשיש, והערה קצרה (עד 20 מילים) שמסבירה את הניקוד.
בנוסף, הערה כללית קצרה (2–3 משפטים), עניינית ובונה. טקסט רגיל בלבד, בלי Markdown.
זו הצעה בלבד: המורה עורכת ומאשרת. הגש/י דרך הכלי submit_scores, עם ניקוד לכל מזהה ברשימה.`,
      tools: [
        {
          name: "submit_scores",
          description: "הגשת הצעת הניקוד למורה",
          input_schema: {
            type: "object" as const,
            properties: {
              answers: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string" },
                    points: { type: "number" },
                    note: { type: "string" },
                  },
                  required: ["key", "points", "note"],
                  additionalProperties: false,
                },
              },
              feedback: { type: "string" },
            },
            required: ["answers", "feedback"],
            additionalProperties: false,
          },
        },
      ],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: `המבחן: ${exam.title}\n\n${qa.join("\n\n")}` }],
    });
    const toolUse = msg.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("לא התקבלה הצעת ניקוד. אפשר לנסות שוב.");
    const input = (toolUse.input ?? {}) as { answers?: unknown; feedback?: unknown };
    const max = new Map(answered.map((it) => [it.key, it.maxPoints]));
    if (Array.isArray(input.answers)) {
      for (const a of input.answers) {
        const o = (a ?? {}) as Record<string, unknown>;
        const key = String(o.key ?? "");
        const m = max.get(key);
        if (m == null) continue;
        const p = Number(o.points);
        points[key] = {
          points: Number.isFinite(p) ? Math.max(0, Math.min(m, Math.round(p * 2) / 2)) : 0,
          note: String(o.note ?? ""),
        };
      }
    }
    feedback = String(input.feedback ?? "");
  }

  await db().execute({
    sql: `UPDATE exam_attempts SET claude_points_json = ?, claude_feedback = ?, claude_error = NULL, updated_at = ?
          WHERE exam_id = ? AND user_id = ?`,
    args: [JSON.stringify(points), feedback, now(), examId, userId],
  });
}

export async function approveExamScore(opts: {
  examId: number;
  userId: number;
  points: PointsMap;
  feedback: string;
}) {
  const exam = await getDoc(opts.examId);
  if (!exam) throw new Error("not found");
  const body = examBodyOf(exam);
  const flat: Record<string, number> = {};
  for (const [k, v] of Object.entries(opts.points)) flat[k] = Number(v.points) || 0;
  const score = scoreFromItems(body, flat);
  const t = now();
  await db().execute({
    sql: `UPDATE exam_attempts SET points_json = ?, score = ?, feedback = ?, approved_at = ?, updated_at = ?
          WHERE exam_id = ? AND user_id = ?`,
    args: [JSON.stringify(opts.points), score, opts.feedback, t, t, opts.examId, opts.userId],
  });
  await notifyStudent(opts.userId, {
    kind: `exam-graded:${opts.examId}:${opts.userId}:${t}`,
    title: `הציון במבחן ״${exam.title}״ פורסם`,
    body: `הציון: ${score}`,
    link: `/exams/${opts.examId}`,
  }).catch((e) => console.error("exam grade notify failed", e));
  return score;
}
