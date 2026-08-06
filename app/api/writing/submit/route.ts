import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getAnthropicApiKey } from "@/lib/env";
import { notifyTeachers } from "@/lib/notify";
import { findExercise, levelOf, WRITING_LEVELS } from "@/content/writing/exercises";
import { TAG_ANSWERS, MC_ANSWERS } from "@/content/writing/answers";
import { CLAUDE_MODEL } from "@/lib/claude";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

// Submit one writing exercise. Objective exercises are scored server-side
// (answer keys never reach the client). Free-text gets Claude's FORMATIVE
// feedback — explaining why, pointing toward, never revealing, always
// encouraging. Results are saved and reported to the teacher.
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const userId = Number(user.id);
  const body = await req.json().catch(() => null);
  const exerciseKey = String(body?.exerciseKey ?? "");
  const answers = body?.answers ?? {};
  const exercise = findExercise(exerciseKey);
  if (!exercise) {
    return NextResponse.json({ error: "תרגול לא נמצא." }, { status: 404 });
  }

  let score: number | null = null;
  let feedback = "";
  let details: Record<string, boolean> | null = null;

  if (exercise.kind === "tag") {
    const key = TAG_ANSWERS[exerciseKey] ?? {};
    const ids = Object.keys(key);
    let correct = 0;
    details = {};
    for (const id of ids) {
      const ok = String(answers[id] ?? "") === key[id];
      details[id] = ok;
      if (ok) correct += 1;
    }
    score = Math.round((correct / Math.max(1, ids.length)) * 100);
    feedback =
      score === 100
        ? "מושלם! זיהית כל מרכיב במקומו — סימן שאת רואה את השלד של הטיעון, לא רק את המילים. 🎯"
        : score >= 60
          ? "יפה! רוב המרכיבים במקום. שימי לב למשפטים המסומנים באדום — נסי לשאול על כל אחד: האם הוא קובע (טענה)? מוכיח (נימוק)? מסתתר (הנחה)? או חותם (מסקנה)?"
          : "התחלה אמיצה! טיפ: חפשי קודם את המסקנה (בדרך כלל עם ״לכן״), אחר כך את הטענה המרכזית — והשאר יסתדר. נסי שוב!";
  } else if (exercise.kind === "mc") {
    const correctIdx = MC_ANSWERS[exerciseKey];
    const chosen = Number(answers.choice);
    score = chosen === correctIdx ? 100 : 0;
    feedback =
      score === 100
        ? "בדיוק! שמת את האצבע על הנקודה המדויקת — זו בדיוק המיומנות. 💪"
        : "לא הפעם — אבל הכיוון חשוב יותר מהתוצאה. קראי שוב את הטיעון ושאלי: איזה מרכיב הכי רעוע — ההנחה, הראיה או הקפיצה למסקנה? נסי שוב!";
  } else {
    // free text → Claude formative evaluation (or defer to teacher)
    const apiKey = getAnthropicApiKey();
    const answerText = exercise.fields
      .map((f) => `${f.label}: ${String(answers[f.key] ?? "").slice(0, 1500)}`)
      .join("\n");
    if (apiKey) {
      try {
        const client = new Anthropic({ apiKey });
        const msg = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: 500,
          system: `את/ה מעריך/ה תרגולי כתיבה טיעונית באתר "בינת התורה" (תלמידות כיתה י).
עקרונות מחייבים: משוב מעצב, דוחף ומעודד — לעולם לא "יפה"/"לא טוב" סתמי. הסבירי למה משהו טוב, או כווני לאן לשפר — בלי לגלות תשובה, בלי לחסוך חשיבה. פנייה בלשון נקבה, עברית חמה וקצרה (עד 4 משפטים). החזירי JSON בלבד: {"score": <0-100>, "feedback": "<המשוב>"}`,
          messages: [
            {
              role: "user",
              content: `התרגול: ${exercise.title} — ${exercise.prompt}\n\nהתשובה של התלמידה:\n${answerText}`,
            },
          ],
        });
        const text = msg.content.find((c) => c.type === "text")?.text ?? "";
        const parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
        score = Math.min(100, Math.max(0, Math.round(Number(parsed.score))));
        feedback = String(parsed.feedback ?? "");
      } catch {
        feedback =
          "התשובה נשמרה! ההערכה החכמה לא הצליחה הפעם — המורה תראה את התשובה שלך בדשבורד.";
      }
    } else {
      feedback =
        "התשובה נשמרה ותוערך בהמשך (ההערכה החכמה תופעל בקרוב). בינתיים — כל הכבוד על ההשקעה! 🌱";
    }
  }

  const t = now();
  await db().execute({
    sql: `INSERT INTO writing_results (user_id, exercise_key, score, answers, claude_feedback, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id, exercise_key) DO UPDATE SET
            score = COALESCE(MAX(excluded.score, writing_results.score), excluded.score),
            answers = excluded.answers,
            claude_feedback = excluded.claude_feedback,
            updated_at = excluded.updated_at`,
    args: [userId, exerciseKey, score, JSON.stringify(answers).slice(0, 20000), feedback, t],
  });

  // Level-completion milestone → teacher bell + email (per-exercise would spam).
  const level = levelOf(exerciseKey);
  if (level) {
    const done = await db().execute({
      sql: `SELECT COUNT(DISTINCT exercise_key) AS c FROM writing_results
            WHERE user_id = ? AND exercise_key IN (${level.exercises
              .map(() => "?")
              .join(",")})`,
      args: [userId, ...level.exercises.map((e) => e.key)],
    });
    if (Number(done.rows[0]?.c ?? 0) === level.exercises.length) {
      const name = user.fullName ?? user.email ?? "תלמידה";
      await notifyTeachers({
        kind: `writing-level:${level.n}:${userId}`,
        title: `${name} השלימה את רמה ${level.n} (${level.title}) בכתיבה טיעונית`,
        body: "כל התוצאות בדשבורד המורה.",
        link: `/dashboard`,
      });
    }
  }

  // total levels completed for celebratory UI
  return NextResponse.json({ ok: true, score, feedback, details, levels: WRITING_LEVELS.length });
}
