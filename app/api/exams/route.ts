import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { createExam, duplicateExam, getExam } from "@/lib/exams";

// Teacher only: create a new exam / prep sheet, or duplicate an existing one.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (body.action === "duplicate") {
    const id = await duplicateExam(Number(body.id), guard.userId);
    if (!id) return NextResponse.json({ error: "הפריט לא נמצא." }, { status: 404 });
    return NextResponse.json({ ok: true, id });
  }

  const kind = body.kind === "prep" ? "prep" : "exam";
  let linkedExamId: number | null = null;
  if (kind === "prep" && body.linkedExamId != null) {
    const target = await getExam(Number(body.linkedExamId));
    if (!target || target.kind !== "exam") {
      return NextResponse.json({ error: "המבחן המקושר לא נמצא." }, { status: 404 });
    }
    linkedExamId = target.id;
  }
  const defaultTitle = kind === "prep" ? "דף הכנה חדש" : "מבחן חדש";
  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : defaultTitle;
  const id = await createExam(kind, title, guard.userId, linkedExamId);
  return NextResponse.json({ ok: true, id });
}
