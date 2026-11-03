import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicApiKey } from "./env";
import { CLAUDE_MODEL } from "./claude";
import { getAttemptById, getExam, saveClaudeProposal } from "./exams";
import { examUnits, type ExamDoc } from "./exams-types";

// Claude proposes points per question / sub-question by the teacher's rubric
// ("מחוון") — an exam is graded with a NUMERIC score, unlike tasks. The
// teacher edits the numbers and approves; nothing reaches the student before.
// Never throws: a failure is stored on the attempt (claude_error) so the
// teacher sees a clear message and a retry button.

export async function proposeExamGrade(
  attemptId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const attempt = await getAttemptById(attemptId);
    if (!attempt) return { ok: false, error: "ההגשה לא נמצאה." };
    if (!attempt.submittedAt) return { ok: false, error: "המבחן עוד לא הוגש." };
    const exam = await getExam(attempt.examId);
    if (!exam || exam.kind !== "exam") return { ok: false, error: "המבחן לא נמצא." };
    const apiKey = getAnthropicApiKey();
    if (!apiKey) {
      const error = "מפתח Claude לא מוגדר באתר — אפשר לתת ציון ידנית.";
      await saveClaudeProposal(attemptId, null, null, error);
      return { ok: false, error };
    }
    const doc = exam.doc as ExamDoc;
    const units = examUnits(doc);

    const qa = units
      .map((u) => {
        const answer = (attempt.answers[u.key] ?? "").trim();
        return [
          `[${u.key}] שאלה ${u.label}${u.max !== null ? ` (עד ${u.max} נקודות)` : ""}:`,
          u.text,
          `מחוון / תשובה לדוגמה: ${u.rubric.trim() || "(אין מחוון — שפט/י לפי הידע וההיגיון הפשוט של פשט הכתוב)"}`,
          `תשובת התלמיד/ה: ${answer || "(לא נענתה)"}`,
        ].join("\n");
      })
      .join("\n\n---\n\n");

    const choiceNotes = doc.parts
      .filter((p) => p.answerCount !== null && p.answerCount < p.questions.length)
      .map(
        (p) =>
          `בחלק "${p.title}" עונים על ${p.answerCount} מתוך ${p.questions.length} השאלות — מספיק לנקד את מה שנענה; הציון הכולל יחשב לפי הטובות ביותר.`
      )
      .join("\n");

    const client = new Anthropic({ apiKey, timeout: 100_000, maxRetries: 2 });
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 6000,
      system: `את/ה עוזר/ת בדיקה למורה באתר "בינת התורה" (תורה ונביאים, כיתה י, תיכון שחרית). לפניך מבחן שהוגש. תן/י ניקוד מוצע לכל שאלה או סעיף לפי המחוון של המורה, בחלקי נקודה אם צריך, ומשוב כללי קצר, חם ובונה לתלמיד/ה.
כללים: אל תעבור/י את מספר הנקודות המקסימלי של השאלה; תשובה שלא נענתה מקבלת 0; הניקוד נקבע לפי המחוון ולא לפי אורך התשובה; אם אין מחוון — שפוט/י בזהירות. המשוב הוא טקסט רגיל בלבד, בלי Markdown, ומתייחס לדוגמאות ממה שנכתב.
${choiceNotes}
זו הצעה בלבד — המורה עורכת ומאשרת. הגש/הגישי דרך הכלי submit_exam_grade, עם פריט לכל מפתח שבסוגריים מרובעים.`,
      tools: [
        {
          name: "submit_exam_grade",
          description: "הגשת הניקוד המוצע למורה",
          input_schema: {
            type: "object" as const,
            properties: {
              items: {
                type: "array",
                description: "ניקוד לכל שאלה או סעיף",
                items: {
                  type: "object",
                  properties: {
                    key: { type: "string", description: "המפתח שבסוגריים המרובעים" },
                    points: { type: "number", description: "הניקוד המוצע" },
                    comment: { type: "string", description: "הערה קצרה למורה על הניקוד" },
                  },
                  required: ["key", "points", "comment"],
                },
              },
              feedback: {
                type: "string",
                description: "משוב כללי לתלמיד/ה — טקסט רגיל בלבד",
              },
            },
            required: ["items", "feedback"],
          },
        },
      ],
      tool_choice: { type: "auto", disable_parallel_tool_use: true },
      messages: [{ role: "user", content: `המבחן: ${exam.title}\n\n${qa}` }],
    });

    const tool = msg.content.find((b) => b.type === "tool_use");
    if (!tool || tool.type !== "tool_use") {
      throw new Error("Claude לא החזיר ניקוד");
    }
    const input = tool.input as { items?: unknown; feedback?: unknown };
    const scores: Record<string, number> = {};
    const comments: string[] = [];
    if (Array.isArray(input.items)) {
      for (const it of input.items) {
        const r = it as { key?: unknown; points?: unknown; comment?: unknown };
        const unit = units.find((u) => u.key === r.key);
        const n = Number(r.points);
        if (!unit || !Number.isFinite(n)) continue;
        const capped = Math.max(0, unit.max !== null ? Math.min(n, unit.max) : n);
        scores[unit.key] = Math.round(capped * 100) / 100;
        if (typeof r.comment === "string" && r.comment.trim()) {
          comments.push(`${unit.label}: ${r.comment.trim()}`);
        }
      }
    }
    if (Object.keys(scores).length === 0) throw new Error("Claude לא החזיר ניקוד");
    const feedback = [String(input.feedback ?? "").trim(), comments.length ? `\n\nהערות לפי שאלות:\n${comments.join("\n")}` : ""]
      .join("")
      .replace(/\*\*/g, "")
      .trim();
    await saveClaudeProposal(attemptId, scores, feedback, null);
    return { ok: true };
  } catch (e) {
    const error = `הבדיקה האוטומטית לא הצליחה (${e instanceof Error ? e.message : "שגיאה"}). אפשר לנסות שוב או לתת ציון ידנית.`;
    try {
      await saveClaudeProposal(attemptId, null, null, error);
    } catch {
      // storing the error must not mask it
    }
    return { ok: false, error };
  }
}
