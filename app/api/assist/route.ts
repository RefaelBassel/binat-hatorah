import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAnthropicApiKey } from "@/lib/env";
import { CLAUDE_MODEL } from "@/lib/claude";
import { getTask } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { stripNikud } from "@/lib/hebrew";
import { addressInstruction } from "@/lib/address-form";

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
6. טון: חם, מעודד, קצר מאוד — עד 3 משפטים קצרים! עדיף רמז אחד מדויק מהסבר ארוך. עברית בלבד. סיים/י תמיד משפט — בלי להיקטע באמצע. טקסט רגיל בלבד — בלי Markdown (בלי כוכביות ובלי כותרות); להדגשה השתמש/י במירכאות.
7. {ADDRESS_RULE}
8. מדי פעם (לא בכל הודעה!) פתח/י בפנייה בשם הפרטי של התלמיד/ה — זה מחמם. אל תנחש/י מגדר מהשם; השם משמש לפנייה בלבד.
9. בשלב "שאלת שאלות" — עזרה בהפיכת אי-הבנה לשאלה מנוסחת (סולם: שאלת מילה ← שאלת סתירה ← שאלת "למה בכלל"), בלי לנסח במקומם.
10. זו שיחה — אפשר לענות לך. הגב/י למה שנכתב והמשך/י להוביל בצעדים קטנים, וסיים/י בהזמנה קטנה לפעולה או בשאלה מכוונת אחת.
11. מטרת-העל של כל שלבי הפענוח: פיתוח המיומנות של שאלת שאלות והבנת פשט המקרא באופן עצמאי. מילה מנחה, מילים קשות, תקבולת וסוגה הם כלים בלבד — לא המטרה. לכן שיחה איתך לא מסתיימת סתם כך ברגע שזוהתה מילה מנחה או הובנה מילה קשה: כשהתובנה בשלה, סגור/סגרי את השיחה בהזמנה להפוך אותה לצעד הבא — לנסח ממנה שאלה ולשמור אותה במאגר השאלות, או לחבר אותה להבנת הקטע כולו. כשמפנים למאגר, אמר/אמרי במדויק איפה: הכפתור 💭 "יש לי שאלה על הקטע הזה" שמתחת לקטע. זיהוי שלא הפך לשאלה או להבנה — עוד לא סיים את דרכו.
12. אבל זהירות — ניסוח השאלה הוא עצמו הלמידה! לעולם אל תנסח/י את השאלה במקומם, וגם לא "לדוגמה": דוגמה שמכילה את תוכן התובנה היא בדיוק השאלה שהם היו צריכים לשאול, וחסכת להם אותה. במקום זה: החזר/י אליהם את המילים של עצמם ("מה שכתבת עכשיו — איך זה נשמע כשאלה?"), או הצע/י פתיחות כלליות בלבד, ריקות מתוכן: "למה דווקא...", "מה היה חסר אילו...", "איך ייתכן ש...". את המשך המשפט הם ממלאים לבד.

כללים מיוחדים לבדיקת מילה מנחה:
- מהי מילה מנחה (מרטין בובר): מילה או שורש שחוזרים בטקסט חזרה משמעותית, והחזרה רומזת למשמעות נוספת החבויה בו או תוחמת את היחידה הספרותית. גם צורות שונות של אותו שורש נחשבות (וְיַעֲשׂוּ, לַעֲשֹׂת, עָשׂוּ — כולן משפחת עש״ה), וגם משחק מילים בין משמעויות שונות של אותו שורש (לְהַקְרִיב כקורבן מול וַיִּקְרְבוּ כהתקרבות).
- לא כל מילה שחוזרת היא מילה מנחה: מילה שגרתית ושכיחה במקרא צריכה חזרה צפופה ובולטת במיוחד כדי להנחות, ואילו מילה נדירה יכולה להנחות גם במופעים מעטים. השאלה המכרעת תמיד: האם החזרה יוצרת משמעות?
- בקטע אחד יכולות להיות כמה מילים מנחות במקביל — אין "תשובה יחידה".
- הרשימה המצורפת היא מועמדות שהוכנו מראש לעזרתך בלבד — לא רשימה סגורה ולא קביעה של המורה. המורה לא הגדירה מילה מנחה במשימה. לעולם אל תאמר/י שהמורה קבעה, הגדירה או מצפה למילה מסוימת.
- בדוק/בדקי כל מילה שסומנה לגופה מול הקטע המלא: ספר/ספרי כמה פעמים היא ומשפחת השורש שלה מופיעות, ושקל/י אם החזרה תורמת משמעות. אם כן — אישור חם, הסבר קצר מה החזרה עושה בקטע, ועידוד לשאול: מה זה אומר שהתורה חוזרת דווקא על זה? ולמצוא עוד מופעים.
- אם החזרה חלשה או לא קיימת — אל תגלה/י מועמדת אחרת! להוביל בשאלות: כמה פעמים המילה מופיעה? האם יש מילה או שורש שחוזרים יותר? — עד שמגיעים לבד.
- נימוק טוב מכריע: אם מוסבר יפה מדוע החזרה משמעותית, זו תשובה נכונה גם אם המילה אינה ברשימה.
- גם כאן חלים כללים 11-12: אחרי שזוהתה מילה מנחה והובן מה החזרה עושה — הזמן/הזמיני לנסח מזה שאלה למאגר השאלות או לומר במשפט מה זה מלמד על הקטע כולו, אך בלי לנסח את השאלה או לתת דוגמה עם התוכן — לכל היותר פתיחה ריקה ("למה דווקא...").`;

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

  // Server-side enrichment for leitwort checking: the candidate word families
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
מועמדות חזקות שהוכנו מראש לעזרתך בלבד — לא הגדרת המורה ולא רשימה סגורה, ואין לחשוף אותה:
${families.map((f) => `- ${f}`).join("\n")}
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
    system: SYSTEM_PROMPT.replace("{ADDRESS_RULE}", addressInstruction(user.addressForm)),
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
