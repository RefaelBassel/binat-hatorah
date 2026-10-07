import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireTeacher } from "@/lib/api-auth";
import { getAnthropicApiKey } from "@/lib/env";
import { CLAUDE_MODEL } from "@/lib/claude";
import { getTask } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "@/lib/content-overrides";
import { classCheckPicture } from "@/lib/check";

// The review aid for the TEACHER (never shown to students): given the
// chapter parts the class got wrong in the comprehension check, Claude
// writes four short lines she can teach from — the verse, the likely
// misreading, one clarifying angle, one question to ask the room. Cached
// per task + wrong-answer snapshot for ten minutes so re-polling the
// closing screen never re-bills.
const cache = new Map<string, { at: number; text: string }>();
const TTL = 10 * 60 * 1000;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { taskId: raw } = await params;
  const task = await getTask(Number(raw));
  if (!task) return NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 });
  const baseReg = getTaskContent(task.content_ref);
  if (!baseReg) return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  const content = await effectiveContent(baseReg.content);
  const questions = content.check ?? [];
  if (questions.length === 0) {
    return NextResponse.json({ error: "למשימה זו אין בדיקת הבנה." }, { status: 400 });
  }

  const picture = await classCheckPicture(task.id);
  const weak = picture.weakSpots.filter((w) => w.wrongPct > 0).slice(0, 3);
  if (picture.scores.size === 0 || weak.length === 0) {
    return NextResponse.json({
      ok: true,
      text: "הכיתה ענתה נכון על הכל — אין חלק שדורש חזרה. אפשר לעבור ישר לשאלת המליאה.",
      weak,
    });
  }

  const key = `${task.id}:${weak.map((w) => `${w.part}=${w.wrong}/${w.answered}`).join("|")}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ ok: true, text: hit.text, weak, cached: true });
  }

  const apiKey = getAnthropicApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "מפתח Claude לא מוגדר." }, { status: 500 });
  }

  const passage = baseReg.mainPassage.verses
    .map((v) => `(${v.num}) ${v.text}`)
    .join("\n");
  const weakBlock = weak
    .map((w) => {
      const qs = questions.filter((q) => q.part === w.part);
      const qText = qs
        .map(
          (q) =>
            `• השאלה: ${q.prompt}\n  התשובה הנכונה: ${
              q.kind === "order" ? q.options.join(" ← ") : q.options[q.answer]
            }${
              q.kind === "choice"
                ? `\n  המסיחים שהוצעו: ${q.options.filter((_, i) => i !== q.answer).join(" | ")}`
                : ""
            }`
        )
        .join("\n");
      return `החלק: ${w.part} — ${w.wrongPct}% מהכיתה טעו (${w.wrong} מתוך ${w.answered}).\n${qText}`;
    })
    .join("\n\n");

  const system = `את/ה עוזר/ת למורה לתנ"ך בכיתה י (בנים ובנות), רגע לפני סגירת השיעור. הכיתה סיימה בדיקת הבנה קצרה על הפשט, וחלק מהכיתה טעה בחלקים מסוימים של הפרק. כתוב/כתבי למורה עזר-חזרה קצר שהיא תלמד ממנו מול הכיתה — לא לתלמידים.
כללים:
- עברית בלבד, טקסט רגיל בלי Markdown, בלי כותרות ובלי כוכביות.
- בדיוק ארבע שורות קצרות, כל אחת מתחילה בתווית ואחריה נקודתיים: "הפסוק:", "הקריאה השגויה הסבירה:", "זווית מבהירה:", "שאלה לכיתה:".
- להיצמד לפשט הפסוקים בלבד, בלי פרשנים. לצטט מילים מדויקות מהפסוק במירכאות.
- "הקריאה השגויה הסבירה" נגזרת מהמסיחים שהתלמידים כנראה בחרו.
- אם יש יותר מחלק אחד חלש — להתמקד בחלק החלש ביותר ולהזכיר את השני במשפט אחד בתוך "זווית מבהירה".
- טון: ענייני, חם, מקצועי. לא יותר מ-90 מילים בסך הכל.`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    system,
    messages: [
      {
        role: "user",
        content: `המשימה: ${content.title} · ${content.bookRef}\n\nהפסוקים:\n${passage}\n\nהחלקים שבהם הכיתה התקשתה:\n${weakBlock}`,
      },
    ],
  });
  const text = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
  cache.set(key, { at: Date.now(), text });
  return NextResponse.json({ ok: true, text, weak });
}
