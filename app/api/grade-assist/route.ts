import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { getAnthropicApiKey } from "@/lib/env";
import { proposeGrade } from "@/lib/grade-assist";

// Opus with forced tool use can take well over the default function limit;
// without this the platform cut the request off and the panel got no answer.
export const maxDuration = 120;

// Claude proposes a score + feedback for a submission. The teacher edits and
// approves — nothing reaches the student without teacher approval. Every
// outcome returns JSON with a Hebrew `error` on failure, so the panel can
// always show what happened.
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

  try {
    const result = await proposeGrade(apiKey, taskId, studentId);
    if (!result) {
      return NextResponse.json({ error: "משימה לא נמצאה." }, { status: 404 });
    }
    return NextResponse.json({ available: true, ...result });
  } catch (err) {
    console.error("grade-assist failed", { taskId, studentId, err });
    return NextResponse.json(
      { error: "הבדיקה האוטומטית נכשלה הפעם (שגיאה בשירות של קלוד)." },
      { status: 502 }
    );
  }
}
