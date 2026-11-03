import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/api-auth";
import { getDoc, saveDoc } from "@/lib/exams";
import { parseExamBody, parsePrepBody } from "@/lib/exam-types";

// Teacher autosave of an exam / prep sheet.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const doc = await getDoc(Number(id));
  if (!doc) return NextResponse.json({ error: "הפריט לא נמצא." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  const title = String(body.title ?? "").slice(0, 300);
  const dur = Number(body.durationMin);
  const durationMin = doc.kind === "exam" && Number.isFinite(dur) && dur > 0 ? Math.round(dur) : null;
  const parsed = doc.kind === "exam" ? parseExamBody(body.body) : parsePrepBody(body.body);
  try {
    await saveDoc(doc.id, { title, durationMin, bodyJson: JSON.stringify(parsed) });
    if (doc.publishedAt) revalidatePath("/exams");
    return NextResponse.json({ ok: true, savedAt: Math.floor(Date.now() / 1000) });
  } catch (e) {
    console.error("exam save failed", e);
    return NextResponse.json({ error: "לא נשמר. בדקו את החיבור." }, { status: 500 });
  }
}
