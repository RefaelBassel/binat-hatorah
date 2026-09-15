import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireTeacher } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { getAnthropicApiKey } from "@/lib/env";
import { getTask, getAnswers, getMarkings, now } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { CLAUDE_MODEL } from "@/lib/claude";
import { addressInstruction } from "@/lib/address-form";
import { salvageGradeProposal } from "@/lib/grade-utils";

// Claude proposes a score + feedback for a submission. The teacher edits and
// approves — nothing reaches the student without teacher approval.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const studentId = Number(body?.userId);
  if (!Number.isInteger(taskId) || !Number.isInteger(studentId)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({
      available: false,
      error: "מפתח ה-API של אנתרופיק עוד לא הוגדר — ההצעה האוטומטית תופעל בהמשך.",
    });
  }

  const task = await getTask(taskId);
  if (!task) return NextResponse.json({ error: "משימה לא נמצאה." }, { status: 404 });
  const reg = getTaskContent(task.content_ref);
  const answers = await getAnswers(taskId, studentId);
  const markings = await getMarkings(taskId, studentId);
  const studentRow = await db().execute({
    sql: "SELECT full_name, email, address_form FROM users WHERE id = ?",
    args: [studentId],
  });
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
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1200,
    system: `את/ה עוזר/ת הערכה למורה באתר "בינת התורה" (תנ"ך, כיתה י — בנים ובנות, תיכון שחרית).
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
    const input = toolUse.input as { score?: unknown; feedback?: unknown };
    if (Number.isFinite(Number(input.score))) {
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

  const t = now();
  await db().execute({
    sql: `INSERT INTO grades (task_id, user_id, claude_score, claude_feedback, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(task_id, user_id) DO UPDATE SET
            claude_score = excluded.claude_score,
            claude_feedback = excluded.claude_feedback,
            updated_at = excluded.updated_at`,
    args: [taskId, studentId, score, feedback, t],
  });

  return NextResponse.json({ available: true, score, feedback });
}
