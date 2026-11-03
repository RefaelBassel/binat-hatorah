import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { getAnswers, getMarkings, getTask, now } from "./tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { getAnthropicApiKey } from "./env";
import { CLAUDE_MODEL } from "./claude";
import { addressInstruction } from "./address-form";
import { notifyStudent } from "./notify";
import {
  COMPLETION_META,
  ensureCompletionColumns,
  gradableQuestions,
  isAnswerMark,
  relevantCount,
  statusFromCounts,
  type CompletionStatus,
  type Marks,
} from "./completion";

// The automatic check proposes a completion status (בוצע / בוצע חלקית / לא
// בוצע) and a mark + short note for every answer — no numeric score (#24).
// The teacher edits and approves; nothing reaches the student before that.
//
// Runs automatically when a student submits (see the submit route), from the
// grade-proposals cron (older submissions — including ones approved under
// the old numeric grade, which get a new-style proposal — and runs that never
// finished), and on demand from the submission page. A failed run is retried
// once right away. Failures never throw: they are stored on the grades row
// (claude_error) so the teacher sees a clear message and a retry button
// instead of an empty panel.

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
  if (!cols.has("claude_attempts")) {
    await db().execute("ALTER TABLE grades ADD COLUMN claude_attempts INTEGER NOT NULL DEFAULT 0");
  }
  if (!cols.has("claude_submitted_at")) {
    await db().execute("ALTER TABLE grades ADD COLUMN claude_submitted_at INTEGER");
  }
  await ensureCompletionColumns();
  columnsReady = true;
}

export type GradeProposal =
  | { ok: true; status: CompletionStatus; marks: Marks; feedback: string }
  | { ok: false; error: string };

// An error a second try cannot fix (missing API key, task or student).
class FinalError extends Error {}

export async function proposeGrade(taskId: number, studentId: number): Promise<GradeProposal> {
  await ensureGradeAssistColumns();
  // the submission this proposal belongs to — a re-submission makes it stale
  const progress = await db().execute({
    sql: "SELECT submitted_at FROM task_progress WHERE task_id = ? AND user_id = ?",
    args: [taskId, studentId],
  });
  const submittedAt = (progress.rows[0]?.submitted_at as number | null | undefined) ?? null;

  let result: GradeProposal = { ok: false, error: describeError(null) };
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      result = await runProposal(taskId, studentId);
      break;
    } catch (err) {
      console.error("grade-assist failed", { taskId, studentId, attempt, err });
      result = { ok: false, error: describeError(err) };
      if (err instanceof FinalError) break;
      if (attempt === 1) await new Promise((r) => setTimeout(r, 5000));
    }
  }

  const t = now();
  if (result.ok) {
    // claude_score is left as it was: an old numeric proposal stays in the
    // DB, a new run never writes one
    await db().execute({
      sql: `INSERT INTO grades (task_id, user_id, claude_status, claude_marks, claude_feedback,
                                claude_error, claude_error_at, claude_attempts, claude_submitted_at, updated_at)
            VALUES (?, ?, ?, ?, ?, NULL, NULL, 0, ?, ?)
            ON CONFLICT(task_id, user_id) DO UPDATE SET
              claude_status = excluded.claude_status,
              claude_marks = excluded.claude_marks,
              claude_feedback = excluded.claude_feedback,
              claude_error = NULL,
              claude_error_at = NULL,
              claude_attempts = 0,
              claude_submitted_at = excluded.claude_submitted_at,
              updated_at = excluded.updated_at`,
      args: [taskId, studentId, result.status, JSON.stringify(result.marks), result.feedback, submittedAt, t],
    });
  } else {
    // keep any earlier good proposal; only record the failure
    await db().execute({
      sql: `INSERT INTO grades (task_id, user_id, claude_error, claude_error_at, claude_attempts, updated_at)
            VALUES (?, ?, ?, ?, 1, ?)
            ON CONFLICT(task_id, user_id) DO UPDATE SET
              claude_error = excluded.claude_error,
              claude_error_at = excluded.claude_error_at,
              claude_attempts = grades.claude_attempts + 1,
              updated_at = excluded.updated_at`,
      args: [taskId, studentId, result.error, t, t],
    });
  }
  return result;
}

// Work that needs a (new-style) proposal: submitted — or approved under the
// old numeric grade — and not yet approved with a status, with no status
// proposal, or one written for an earlier submission (un-submit → re-submit).
const NEEDS_PROPOSAL = `(p.submitted_at IS NOT NULL OR g.approved_at IS NOT NULL)
            AND g.status_approved_at IS NULL
            AND (g.claude_status IS NULL
                 OR (g.claude_submitted_at IS NOT NULL AND p.submitted_at IS NOT NULL
                     AND g.claude_submitted_at <> p.submitted_at))`;

// Submitted work that still has no proposal (for the bulk re-run).
export async function submissionsMissingProposal(taskId: number): Promise<number[]> {
  await ensureGradeAssistColumns();
  const res = await db().execute({
    sql: `SELECT p.user_id FROM task_progress p
          LEFT JOIN grades g ON g.task_id = p.task_id AND g.user_id = p.user_id
          WHERE p.task_id = ? AND ${NEEDS_PROPOSAL}
          ORDER BY p.submitted_at`,
    args: [taskId],
  });
  return res.rows.map((r) => Number(r.user_id));
}

// The cron's work list, across all tasks: submissions that need a proposal,
// skipping fresh ones (the submit route is still on them) and ones that
// already failed three automatic rounds (the teacher sees the error and the
// retry button). A failed one waits half an hour before the next round.
export async function pendingProposalsForCron(
  limit: number
): Promise<{ taskId: number; userId: number }[]> {
  await ensureGradeAssistColumns();
  const t = now();
  const res = await db().execute({
    sql: `SELECT p.task_id, p.user_id FROM task_progress p
          LEFT JOIN grades g ON g.task_id = p.task_id AND g.user_id = p.user_id
          WHERE ${NEEDS_PROPOSAL}
            AND COALESCE(p.submitted_at, 0) < ?
            AND COALESCE(g.claude_attempts, 0) < 3
            AND (g.claude_error_at IS NULL OR g.claude_error_at < ?)
          ORDER BY p.submitted_at
          LIMIT ?`,
    args: [t - 300, t - 1800, limit],
  });
  return res.rows.map((r) => ({ taskId: Number(r.task_id), userId: Number(r.user_id) }));
}

export type ReviewState = "approved" | "pending_approval" | "preparing" | "failed";

// A status proposal counts only if it was written for the current submission.
export function hasFreshProposal(r: Record<string, unknown>): boolean {
  return (
    r.claude_status != null &&
    (r.claude_submitted_at == null ||
      r.submitted_at == null ||
      Number(r.claude_submitted_at) === Number(r.submitted_at))
  );
}

// Where each submitted work of a task stands in the review flow, in
// submission order: approved / proposal waiting for the teacher / proposal
// still being prepared / automatic check failed (teacher must retry).
export async function reviewStates(
  taskId: number
): Promise<{ userId: number; state: ReviewState }[]> {
  await ensureGradeAssistColumns();
  const res = await db().execute({
    sql: `SELECT p.user_id, g.approved_at, g.status_approved_at, g.claude_status, g.claude_error,
                 g.claude_submitted_at, p.submitted_at
          FROM task_progress p
          LEFT JOIN grades g ON g.task_id = p.task_id AND g.user_id = p.user_id
          WHERE p.task_id = ? AND (p.submitted_at IS NOT NULL OR g.approved_at IS NOT NULL)
          ORDER BY p.submitted_at`,
    args: [taskId],
  });
  return res.rows.map((r) => {
    const state: ReviewState =
      r.status_approved_at != null
        ? "approved"
        : hasFreshProposal(r)
          ? "pending_approval"
          : r.claude_error != null
            ? "failed"
            : "preparing";
    return { userId: Number(r.user_id), state };
  });
}

// The teacher's final approval: only now do the status and the marks become
// visible to the student, who is notified by bell + email.
export async function approveGrade(opts: {
  taskId: number;
  studentId: number;
  status: CompletionStatus;
  marks: Marks;
  feedback: string;
  teacherId: number;
}) {
  const { taskId, studentId, status, marks, feedback, teacherId } = opts;
  await ensureGradeAssistColumns();
  const t = now();
  await db().execute({
    sql: `INSERT INTO grades (task_id, user_id, status, marks, feedback, graded_by,
                              approved_at, status_approved_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            status = excluded.status,
            marks = excluded.marks,
            feedback = excluded.feedback,
            graded_by = excluded.graded_by,
            approved_at = COALESCE(grades.approved_at, excluded.approved_at),
            status_approved_at = COALESCE(grades.status_approved_at, excluded.status_approved_at),
            updated_at = excluded.updated_at`,
    args: [taskId, studentId, status, JSON.stringify(marks), feedback, teacherId, t, t, t],
  });
  const task = await getTask(taskId);
  await notifyStudent(studentId, {
    kind: `graded:${taskId}:${studentId}`,
    title: `המשימה ״${task?.title ?? ""}״ נבדקה — ${COMPLETION_META[status].label}`,
    body: feedback
      ? `הערת המורה: ${feedback.slice(0, 500)}`
      : "ליד כל תשובה במשימה מחכה לך סימון של המורה.",
    link: `/tasks/${taskId}`,
  });
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
  if (err instanceof FinalError) return err.message;
  return base;
}

class NoProposalError extends Error {}

async function runProposal(taskId: number, studentId: number): Promise<GradeProposal> {
  const task = await getTask(taskId);
  if (!task) throw new FinalError("המשימה לא נמצאה.");
  const reg = getTaskContent(task.content_ref);
  const questions = await gradableQuestions(task.content_ref);
  const answers = await getAnswers(taskId, studentId);
  const answered = questions.filter((q) => (answers[q.key] ?? "").trim() !== "");

  // nothing answered: "לא בוצע" needs no model run
  if (answered.length === 0) {
    return { ok: true, status: statusFromCounts(0, questions.length), marks: {}, feedback: "" };
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    throw new FinalError(
      "הבדיקה האוטומטית לא זמינה: מפתח ה-API של אנתרופיק לא הוגדר בשרת — יש לפנות לרפאל."
    );
  }

  const markings = await getMarkings(taskId, studentId);
  const studentRow = await db().execute({
    sql: "SELECT full_name, email, address_form FROM users WHERE id = ?",
    args: [studentId],
  });
  if (!studentRow.rows[0]) throw new FinalError("התלמיד/ה לא נמצא/ה.");
  const studentName =
    (studentRow.rows[0]?.full_name as string | null) ??
    (studentRow.rows[0]?.email as string | undefined) ??
    "התלמידה";

  const qa = answered.map(
    (q) => `[מזהה: ${q.key}] ${q.label}\nשאלה: ${q.prompt}\nתשובה: ${answers[q.key]}`
  );
  const markingsText = markings
    .map((m) => `${m.kind}: ${m.wordText}${m.note ? ` (${m.note})` : ""}`)
    .join(", ");
  const passage = reg ? reg.mainPassage.verses.map((v) => v.text).join("\n") : "";

  // Structured output through the submit_review tool. Claude Opus 5.5
  // rejects a FORCED tool choice (400), so the choice is "auto" with a
  // strict schema and an instruction to use the tool.
  const client = new Anthropic({ apiKey, timeout: 100_000, maxRetries: 2 });
  const studentEnglish = (await (await import("./task-lang")).getTaskLang(studentId)) === "en";
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 6000,
    system: `את/ה עוזר/ת בדיקה למורה באתר "בינת התורה" (${
      reg?.content.writing ? "תרגול כתיבה טיעונית" : 'תנ"ך'
    }, כיתה י — בנים ובנות, תיכון שחרית). אין ציונים מספריים — בשום מקום.
לכל תשובה ברשימה תן/תני סימון אחד:
- "correct" — נכונה.
- "partial" — תשובה פתוחה שנכונה רק בחלקה.
- "incorrect" — מתייחסת לשאלה אבל לא נכונה.
- "irrelevant" — לא נחשבת תשובה: גיבוב אותיות, תווים אקראיים, העתקה של השאלה עצמה, או טקסט שלא קשור לשאלה.
${reg?.content.writing ? 'בתרגול כתיבה "נכון" פירושו שהתשובה עונה היטב על מה שהשלב מבקש (טענה ברורה, נימוק שתומך בה, ראיה מדויקת, הצד השני בכנות וכו\').\n' : ""}לכל תשובה גם הערה קצרה (משפט אחד, עד 20 מילים) — מה טוב או מה חסר, בלי לגלות את התשובה המלאה; מותר להשאיר ריק כשהתשובה נכונה ואין מה להוסיף.
בנוסף, הערה כללית קצרה (2–3 משפטים) — חמה, עניינית ובונה.
טקסט רגיל בלבד, בלי Markdown. שפה: ${addressInstruction(
      studentRow.rows[0]?.address_form as string | null
    )} מותר לפנות בשם הפרטי.
${passage ? `הטקסט הנלמד:\n${passage}\n` : ""}${studentEnglish ? "התלמידה עובדת באנגלית: היא עשויה לענות באנגלית או בעברית — בדוק/בדקי תשובות באנגלית כרגיל. את ההערות לכל תשובה ואת ההערה הכללית כתוב/כתבי באנגלית (הן מגיעות אליה).\n" : ""}זו הצעה בלבד — המורה עורך/ת ומאשר/ת. הגש/הגישי דרך הכלי submit_review, עם סימון לכל מזהה ברשימה.`,
    tools: [
      {
        name: "submit_review",
        description: "הגשת הצעת הבדיקה למורה: סימון והערה לכל תשובה, והערה כללית",
        input_schema: {
          type: "object" as const,
          properties: {
            answers: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  key: { type: "string", description: "המזהה של השאלה, בדיוק כפי שנמסר" },
                  mark: { type: "string", enum: ["correct", "incorrect", "partial", "irrelevant"] },
                  note: { type: "string", description: "הערה קצרה, או מחרוזת ריקה" },
                },
                required: ["key", "mark", "note"],
                additionalProperties: false,
              },
            },
            feedback: { type: "string", description: "הערה כללית קצרה לתלמיד/ה" },
          },
          required: ["answers", "feedback"],
          additionalProperties: false,
        },
        strict: true,
      },
    ],
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    messages: [
      {
        role: "user",
        content: `שם התלמיד/ה: ${studentName} (לפנייה בשם הזה בלבד — לא להמציא שם אחר ולא להסיק מגדר)

המשימה: ${task.title}

סימוני פענוח הפשט (רקע בלבד): ${markingsText || "(אין)"}

התשובות לבדיקה:
${qa.join("\n\n")}`,
      },
    ],
  });

  const toolUse = msg.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new NoProposalError(
      msg.stop_reason === "max_tokens" ? "הבדיקה נקטעה באמצע." : "לא התקבלה הצעה מהמודל."
    );
  }
  const input = (toolUse.input ?? {}) as { answers?: unknown; feedback?: unknown };
  const valid = new Set(answered.map((q) => q.key));
  const marks: Marks = {};
  if (Array.isArray(input.answers)) {
    for (const a of input.answers) {
      const o = (a ?? {}) as Record<string, unknown>;
      const key = String(o.key ?? "");
      if (!valid.has(key) || !isAnswerMark(o.mark)) continue;
      marks[key] = {
        mark: o.mark,
        note: String(o.note ?? "").replace(/\*\*/g, "").trim().slice(0, 600),
      };
    }
  }
  if (Object.keys(marks).length === 0) {
    throw new NoProposalError("לא התקבלו סימונים לתשובות.");
  }
  const feedback = String(input.feedback ?? "").replace(/\*\*/g, "").trim();
  const status = statusFromCounts(relevantCount(questions, answers, marks), questions.length);
  return { ok: true, status, marks, feedback };
}
