import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { getAnthropicApiKey } from "./env";
import { getTask, getAnswers, getMarkings, now } from "./tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { CLAUDE_MODEL } from "./claude";
import { addressInstruction } from "./address-form";
import { salvageGradeProposal } from "./grade-utils";

// Claude proposes a score + feedback for a submission. The teacher edits and
// approves — nothing reaches the student without teacher approval.
//
// Runs automatically when a student submits (see the submit route) and on
// demand from the submission page. Failures never throw: they are stored on
// the grades row (claude_error) so the teacher sees a clear message and a
// retry button instead of an empty panel.

let columnsReady = false;
export async function ensureGradeAssistColumns() {
  if (columnsReady) return;
  const info = await db().execute("PRAGMA table_info(grades)");
  const cols = new Set(info.rows.map((r) => String(r.name)));
  if (!cols.has("claude_error")) {
    await db().execute("ALTER TABLE grades ADD COLUMN claude_error TEXT");
  }
  if (!cols.has("claude_error_at")) {
    await db().execute("ALTER TABLE grades ADD COLUMN claude_error_at INTEGER");
  }
  columnsReady = true;
}

export type GradeProposal =
  | { ok: true; score: number | null; feedback: string }
  | { ok: false; error: string };

export async function proposeGrade(taskId: number, studentId: number): Promise<GradeProposal> {
  await ensureGradeAssistColumns();
  let result: GradeProposal;
  try {
    result = await runProposal(taskId, studentId);
  } catch (err) {
    console.error("grade-assist failed", { taskId, studentId, err });
    result = { ok: false, error: describeError(err) };
  }

  const t = now();
  if (result.ok) {
    await db().execute({
      sql: `INSERT INTO grades (task_id, user_id, claude_score, claude_feedback, claude_error, claude_error_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, NULL, ?)
            ON CONFLICT(task_id, user_id) DO UPDATE SET
              claude_score = excluded.claude_score,
              claude_feedback = excluded.claude_feedback,
              claude_error = NULL,
              claude_error_at = NULL,
              updated_at = excluded.updated_at`,
      args: [taskId, studentId, result.score, result.feedback, t],
    });
  } else {
    // keep any earlier good proposal; only record the failure
    await db().execute({
      sql: `INSERT INTO grades (task_id, user_id, claude_error, claude_error_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(task_id, user_id) DO UPDATE SET
              claude_error = excluded.claude_error,
              claude_error_at = excluded.claude_error_at,
              updated_at = excluded.updated_at`,
      args: [taskId, studentId, result.error, t, t],
    });
  }
  return result;
}

// Submitted work that still has no proposal (for the bulk re-run).
export async function submissionsMissingProposal(taskId: number): Promise<number[]> {
  const res = await db().execute({
    sql: `SELECT p.user_id FROM task_progress p
          LEFT JOIN grades g ON g.task_id = p.task_id AND g.user_id = p.user_id
          WHERE p.task_id = ? AND p.submitted_at IS NOT NULL
            AND g.approved_at IS NULL
            AND (g.claude_feedback IS NULL OR TRIM(g.claude_feedback) = '')
          ORDER BY p.submitted_at`,
    args: [taskId],
  });
  return res.rows.map((r) => Number(r.user_id));
}

function describeError(err: unknown): string {
  const base = "הבדיקה האוטומטית נכשלה — נסי שוב.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return `${base} (הבדיקה לקחה יותר מדי זמן.)`;
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return `${base} (אין חיבור לשירות הבדיקה.)`;
  }
  if (err instanceof Anthropic.APIError) {
    const msg = String(err.message ?? "").toLowerCase();
    if (err.status === 401 || err.status === 403) {
      return `${base} (מפתח ה-API של אנתרופיק לא תקין — יש לפנות לרפאל.)`;
    }
    if (msg.includes("credit balance")) {
      return `${base} (נגמרה יתרת השימוש בחשבון אנתרופיק — יש לפנות לרפאל.)`;
    }
    if (err.status === 429) return `${base} (עומס זמני על השירות — כדאי לחכות דקה.)`;
    if (err.status === 529 || (err.status ?? 0) >= 500) {
      return `${base} (השירות עמוס כרגע.)`;
    }
    return `${base} (שגיאה ${err.status ?? ""} מהשירות.)`;
  }
  if (err instanceof NoProposalError) return `${base} (${err.message})`;
  return base;
}

class NoProposalError extends Error {}

async function runProposal(taskId: number, studentId: number): Promise<GradeProposal> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return {
      ok: false,
      error: "הבדיקה האוטומטית לא זמינה: מפתח ה-API של אנתרופיק לא הוגדר בשרת — יש לפנות לרפאל.",
    };
  }

  const task = await getTask(taskId);
  if (!task) return { ok: false, error: "המשימה לא נמצאה." };
  const reg = getTaskContent(task.content_ref);
  const answers = await getAnswers(taskId, studentId);
  const markings = await getMarkings(taskId, studentId);
  const studentRow = await db().execute({
    sql: "SELECT full_name, email, address_form FROM users WHERE id = ?",
    args: [studentId],
  });
  if (!studentRow.rows[0]) return { ok: false, error: "התלמיד/ה לא נמצא/ה." };
  const studentName =
    (studentRow.rows[0]?.full_name as string | null) ??
    (studentRow.rows[0]?.email as string | undefined) ??
    "התלמידה";

  // Build a compact questions+answers transcript.
  const qa: string[] = [];
  if (reg) {
    for (const section of reg.content.sections) {
      for (const block of section.blocks) {
        if (block.type !== "question") continue;
        if (block.fields) {
          for (const f of block.fields) {
            qa.push(
              `שאלה [${block.label} — ${f.label}]: ${block.prompt}\nתשובה: ${
                answers[`${block.key}:${f.key}`] || "(לא נענתה)"
              }`
            );
          }
        } else {
          qa.push(
            `שאלה [${block.label}]: ${block.prompt}\nתשובה: ${
              answers[block.key] || "(לא נענתה)"
            }`
          );
        }
      }
    }
  }
  const decodeAnswers = Object.entries(answers)
    .filter(([k]) => k.startsWith("decode:"))
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  const markingsText = markings
    .map((m) => `${m.kind}: ${m.wordText}${m.note ? ` (${m.note})` : ""}`)
    .join(", ");

  // Structured output via FORCED tool use: the API hands back a parsed
  // object, so the proposal can never leak into the feedback box as a raw
  // JSON string (which is exactly what happened when the old prose-JSON
  // approach met a feedback containing quotes or newlines).
  const client = new Anthropic({ apiKey, timeout: 100_000, maxRetries: 2 });
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    // a detailed Hebrew evaluation easily passes 1200 tokens; when it did,
    // the tool call was cut off mid-way and no proposal was saved
    max_tokens: 4000,
    system: reg?.content.writing
      ? `את/ה עוזר/ת הערכה למורה באתר "בינת התורה" (כיתה י — בנים ובנות, תיכון שחרית). ההגשה היא תרגול כתיבה טיעונית של כ-40 דקות: קריאת טקסט, פירוק הטיעון שבו, עמדה, נימוקים וראיות, הצד השני, ופסקה שלמה.
הערך/כי בעברית: ציון 0-100 והערכה מילולית חמה, מפורטת ובונה. מחוון: (1) טענה ברורה וחד-משמעית; (2) שני נימוקים שבאמת תומכים בטענה; (3) ראיה מהטקסט מדויקת (ציטוט נכון ושימוש נכון בו) וראיה מהחיים ספציפית; (4) הצד השני מוצג בכנות ובחוזקו, והתשובה לו עניינית; (5) הפסקה השלמה בנויה — פתיחה בטענה, נימוקים, הצד השני, סיום — ובלשון ברורה. ציינ/י לכל קריטריון במשפט מה טוב ומה הצעד הבא, עם ציטוט מדויק ממה שנכתב.
בהירות מוחלטת — המשוב מגיע לתלמיד/ה בכיתה י; טקסט רגיל בלבד, בלי Markdown; להדגשה מירכאות.
הטקסט שנקרא: ${reg.mainPassage.verses.map((v) => v.text).join("\n")}
שפה: ${addressInstruction(studentRow.rows[0]?.address_form as string | null)} מותר לפנות בשם הפרטי.
זו הצעה בלבד — המורה עורך/ת ומאשר/ת. הגש/הגישי את ההערכה דרך הכלי submit_grade.`
      : `את/ה עוזר/ת הערכה למורה באתר "בינת התורה" (תנ"ך, כיתה י — בנים ובנות, תיכון שחרית).
הערך/כי את ההגשה בעברית: ציון 0-100 והערכה מילולית חמה, מפורטת ובונה (מה חוזק, מה לשפר, דוגמה אחת קונקרטית).
בהירות מוחלטת — המשוב מגיע לתלמיד/ה בכיתה י: בלי ניסוחים עמומים; כשמתייחסים למילה מהקטע או ממה שנכתב — צטט/י אותה במדויק; שיהיה ברור בדיוק מה היה טוב ולמה, ומה הצעד הבא.
המשוב הוא טקסט רגיל בלבד — בלי Markdown, בלי כוכביות ובלי כותרות; להדגשה השתמש/י במירכאות.
שים/י לב במיוחד ל: הבנת הפשט, איכות פירוק הטיעון (טענה/נימוק/ביסוס), עומק השאלות שנשאלו, ואיכות הסימונים (מילה מנחה, מילים קשות).
שפה: ${addressInstruction(studentRow.rows[0]?.address_form as string | null)} מותר לפנות בשם הפרטי.
זו הצעה בלבד — המורה עורך/ת ומאשר/ת. הגש/הגישי את ההערכה דרך הכלי submit_grade.`,
    tools: [
      {
        name: "submit_grade",
        description: "הגשת הצעת הציון והמשוב למורה",
        input_schema: {
          type: "object" as const,
          properties: {
            score: {
              type: "integer",
              minimum: 0,
              maximum: 100,
              description: "הציון המוצע, 0-100",
            },
            feedback: {
              type: "string",
              description:
                "ההערכה המילולית לתלמיד/ה — טקסט רגיל בלבד, בלי Markdown",
            },
          },
          required: ["score", "feedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_grade" },
    messages: [
      {
        role: "user",
        content: `שם התלמיד/ה: ${studentName} (לפנייה בשם הזה בלבד — לא להמציא שם אחר ולא להסיק מגדר)

המשימה: ${task.title}

סימוני פענוח הפשט של התלמידה: ${markingsText || "(אין)"}

תשובות שלבי הפענוח:
${decodeAnswers || "(אין)"}

שאלות ותשובות:
${qa.join("\n\n")}`,
      },
    ],
  });

  let score: number | null = null;
  let feedback = "";
  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = (toolUse.input ?? {}) as { score?: unknown; feedback?: unknown };
    if (input.score != null && Number.isFinite(Number(input.score))) {
      score = Math.min(100, Math.max(0, Math.round(Number(input.score))));
    }
    feedback = String(input.feedback ?? "")
      .replace(/\*\*/g, "")
      .trim();
  }
  if (!feedback) {
    // extremely defensive: if no tool call came back, salvage whatever text did
    const text = msg.content.find((c) => c.type === "text")?.text ?? "";
    const rescued = salvageGradeProposal(text, score);
    score = rescued.score;
    feedback = rescued.feedback;
  }
  if (!feedback) {
    throw new NoProposalError(
      msg.stop_reason === "max_tokens"
        ? "ההערכה נקטעה באמצע."
        : "לא התקבלה הצעה מהמודל."
    );
  }
  return { ok: true, score, feedback };
}
