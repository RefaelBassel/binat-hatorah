import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAnthropicApiKey } from "@/lib/env";
import { CLAUDE_MODEL } from "@/lib/claude";
import { getTask } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { stripNikud } from "@/lib/hebrew";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// The site-wide help principle, verbatim from Rafael:
// "אני עשיתי לבד אבל לא פגשתי קיר" — Claude never solves for the student,
// never spares her thinking, but never leaves her stuck. Feedback is always
// FORMATIVE: explains why, points toward, encourages. The student can reply
// and a guided conversation unfolds. Personalized via her help history.
const SYSTEM_PROMPT = `את/ה עוזר/ת לימוד באתר "בינת התורה" — אתר ללימוד תורה ונביאים לתלמידות כיתה י.
העיקרון המחייב שלך: "אני עשיתי לבד אבל לא פגשתי קיר".

כללים מוחלטים:
1. לעולם אל תיתני את התשובה לשאלת המשימה. תפקידך לפתוח דלת, לא לעבור בה.
2. עזרי בצעד הקטן ביותר שיאפשר לתלמידה להמשיך לבד: שאלה מכוונת, רמז, הפניה למילה או לפסוק, פירוק לשלבים.
3. אם התלמידה לא הבינה מושג/מילה/פסוק — הסבירי אותם עצמם בבהירות (זה פינוי הקיר, לא פתרון המשימה).
4. משוב מעצב תמיד: לא "יפה" או "לא נכון" סתמיים — הסבירי למה משהו טוב, או כווני בעדינות לאן להסתכל, מתוך עידוד.
5. התאימי את גובה העזרה לתלמידה הספציפית לפי ההיסטוריה שלה: נעזרת הרבה → העלי מדרגה בהדרגה ועודדי עצמאות; כמעט לא נעזרת → אפשר רמז נדיב יותר.
6. טון: חם, מעודד, קצר (עד 4-5 משפטים). עברית בלבד. פנייה בלשון נקבה.
7. בשלב "שאלת שאלות" — עזרי להפוך אי-הבנה לשאלה מנוסחת (סולם: שאלת מילה ← שאלת סתירה ← שאלת "למה בכלל"), אבל לעולם אל תנסחי במקומה.
8. זו שיחה — התלמידה יכולה לענות לך. הגיבי למה שהיא כותבת והמשיכי להוביל אותה בצעדים קטנים.
9. סיימי בהזמנה קטנה לפעולה או בשאלה מכוונת אחת.

כללים מיוחדים לבדיקת מילה מנחה (כשמסופקת לך רשימת משפחות המילה המנחה שהמורה מצפה להן):
- אם המילה שסימנה שייכת לאחת המשפחות: אשרי בחום, הסבירי בקצרה למה דווקא היא (החזרה שלה בקטע), עודדי אותה לשאול: מה זה אומר שהתורה חוזרת עליה? ועודדי למצוא עוד מופעים שלה, של השורש שלה או של מילים דומות.
- אם המילה לא קשורה: אל תגלי את הנכונה! עודדי אותה להבין לבד: בקשי ממנה לספור כמה פעמים המילה שסימנה מופיעה בקטע, לעומת מילים שחוזרות הרבה. הזכירי מהי מילה מנחה. הובילי אותה בשיחה עד שתגיע בעצמה.
- בחירה חלופית עם נימוק טוב היא לגיטימית — עודדי אותה לנמק, ואם הנימוק משכנע, כבדי אותו.`;

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const userId = Number(user.id);
  const body = await req.json().catch(() => null);
  const context = String(body?.context ?? "").slice(0, 4000);
  const studentInput = String(body?.input ?? "").slice(0, 4000);
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const kind = body?.kind ? String(body.kind) : null;
  const word = body?.word ? String(body.word).slice(0, 60) : null;
  const history: { role: "user" | "assistant"; content: string }[] = Array.isArray(
    body?.history
  )
    ? body.history
        .slice(-10)
        .map((m: { role?: string; content?: string }) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: String(m.content ?? "").slice(0, 2000),
        }))
    : [];

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({
      available: false,
      reply:
        "העזרה החכמה עוד לא חוברה. בינתיים: נסי לקרוא שוב את הקטע לאט, ולסמן מה בדיוק לא מובן — מילה? משפט? רעיון?",
    });
  }

  // Server-side enrichment for leitwort checking: the expected word families
  // and the passage text come from the registry (never shipped to the client
  // as an "answer key" in the prompt UI).
  let enriched = context;
  if (kind === "leitwort" && taskId && word) {
    const task = await getTask(taskId);
    const reg = task ? getTaskContent(task.content_ref) : null;
    if (reg) {
      const passageText = reg.mainPassage.verses.map((v) => v.text).join(" ");
      const families = reg.content.decode.expectedLeitwort ?? [];
      const bare = stripNikud(word);
      enriched = `בדיקת מילה מנחה בקטע ${reg.mainPassage.ref}.
הקטע המלא: ${passageText}
משפחות המילה המנחה שהמורה מצפה להן (אל תחשפי את הרשימה לתלמידה!): ${families.join(", ")}
המילה שהתלמידה סימנה: ״${word}״ (ללא ניקוד: ${bare})
${context}`;
    }
  }

  // Personalization: the student's recent help exchanges.
  const past = await db().execute({
    sql: `SELECT context, student_input, claude_reply FROM assist_log
          WHERE user_id = ? ORDER BY created_at DESC LIMIT 6`,
    args: [userId],
  });
  const historyText = past.rows
    .map(
      (r) =>
        `- הקשר: ${String(r.context).slice(0, 120)} | שאלה: ${String(
          r.student_input ?? ""
        ).slice(0, 120)} | ענית: ${String(r.claude_reply ?? "").slice(0, 120)}`
    )
    .join("\n");

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 450,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `היסטוריית עזרה כללית של התלמידה (להתאמת גובה העזרה):
${historyText || "(אין עדיין — זו פנייה ראשונה)"}

ההקשר הנוכחי במשימה:
${enriched}`,
      },
      ...history,
      ...(studentInput
        ? [{ role: "user" as const, content: studentInput }]
        : []),
    ],
  });

  const reply =
    msg.content.find((c) => c.type === "text")?.text ??
    "נסי לנסח לי מה בדיוק לא מובן — מילה, משפט או רעיון?";

  await db().execute({
    sql: `INSERT INTO assist_log (user_id, task_id, context, student_input, claude_reply, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, taskId, (kind ? `[${kind}] ` : "") + context.slice(0, 480), studentInput.slice(0, 1000), reply, now()],
  });

  return NextResponse.json({ available: true, reply });
}
