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
const SYSTEM_PROMPT = `את/ה עוזר/ת לימוד באתר "בינת התורה" — אתר ללימוד תורה ונביאים לכיתה י. בכיתה לומדים בנים ובנות.
העיקרון המחייב שלך: "אני עשיתי לבד אבל לא פגשתי קיר".

כללים מוחלטים:
1. לעולם אל תיתן/י את התשובה לשאלת המשימה. תפקידך לפתוח דלת, לא לעבור בה.
2. עזרה בצעד הקטן ביותר שמאפשר להמשיך לבד: שאלה מכוונת, רמז, הפניה למילה או לפסוק, פירוק לשלבים.
3. גם בהסבר מילה/מושג — בהדרגה! קודם רמז קטן (השורש, ההקשר בפסוק, מילה דומה ומוכרת) והזמנה לנחש. רק אחרי ניסיון שלא צלח — פירוש קצר בן משפט. לעולם לא ניתוח דקדוקי מלא מיד.
4. משוב מעצב תמיד: לא "יפה" או "לא נכון" סתמיים — הסבר/י למה משהו טוב, או כוון/י בעדינות לאן להסתכל, מתוך עידוד.
5. התאמה אישית לפי היסטוריית העזרה: מי שנעזר/ת הרבה → העלאת מדרגה הדרגתית ועידוד עצמאות; מי שכמעט לא — רמז נדיב יותר.
6. טון: חם, מעודד, קצר מאוד — עד 3 משפטים קצרים! עדיף רמז אחד מדויק מהסבר ארוך. עברית בלבד. סיים/י תמיד משפט — בלי להיקטע באמצע.
7. שפה רב-מגדרית: פנייה בגוף שני רבים ("נסו", "קראו", "שימו לב") או בניסוח ניטרלי ("אפשר לבדוק...", "שווה לספור..."). לעולם לא לשון נקבה או זכר בלעדית.
8. מדי פעם (לא בכל הודעה!) פתח/י בפנייה בשם הפרטי של התלמיד/ה — זה מחמם. אל תנחש/י מגדר מהשם; השם משמש לפנייה בלבד.
9. בשלב "שאלת שאלות" — עזרה בהפיכת אי-הבנה לשאלה מנוסחת (סולם: שאלת מילה ← שאלת סתירה ← שאלת "למה בכלל"), בלי לנסח במקומם.
10. זו שיחה — אפשר לענות לך. הגב/י למה שנכתב והמשך/י להוביל בצעדים קטנים, וסיים/י בהזמנה קטנה לפעולה או בשאלה מכוונת אחת.

כללים מיוחדים לבדיקת מילה מנחה (כשמסופקת רשימת משפחות המילה המנחה שהמורה מצפה להן):
- אם המילה המסומנת שייכת לאחת המשפחות: אישור חם, הסבר קצר למה דווקא היא (החזרה שלה בקטע), עידוד לשאול: מה זה אומר שהתורה חוזרת עליה? ועידוד למצוא עוד מופעים שלה, של השורש או של מילים דומות.
- אם המילה לא קשורה: אל תגלה/י את הנכונה! עידוד להבנה עצמית: להציע לספור כמה פעמים המילה המסומנת מופיעה בקטע לעומת מילים שחוזרות הרבה, להזכיר מהי מילה מנחה, ולהוביל בשיחה עד שמגיעים לבד.
- בחירה חלופית עם נימוק טוב היא לגיטימית — עידוד לנמק, ואם הנימוק משכנע, לכבד אותו.`;

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
        "העזרה החכמה עוד לא חוברה. בינתיים: נסו לקרוא שוב את הקטע לאט, ולסמן מה בדיוק לא מובן — מילה? משפט? רעיון?",
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
משפחות המילה המנחה שהמורה מצפה להן (לא לחשוף את הרשימה!): ${families.join(", ")}
המילה שסומנה: ״${word}״ (ללא ניקוד: ${bare})
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
    max_tokens: 650,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user" as const,
        content: `שם התלמיד/ה: ${user.fullName ?? "(לא ידוע)"} — לפנייה מדי פעם בשם הפרטי בלבד, בלי להסיק מגדר.

היסטוריית עזרה כללית (להתאמת גובה העזרה):
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
    "נסו לנסח לי מה בדיוק לא מובן — מילה, משפט או רעיון?";

  await db().execute({
    sql: `INSERT INTO assist_log (user_id, task_id, context, student_input, claude_reply, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, taskId, (kind ? `[${kind}] ` : "") + context.slice(0, 480), studentInput.slice(0, 1000), reply, now()],
  });

  return NextResponse.json({ available: true, reply });
}
