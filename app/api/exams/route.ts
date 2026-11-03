import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { createDoc, duplicateDoc, getDoc, setGuideExamLink, setPrepLink } from "@/lib/exams";

// Teacher: new exam, duplicate, or a new prep sheet linked to an exam.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action ?? "");
  try {
    if (action === "create") {
      const kind = body?.kind === "prep" ? "prep" : "exam";
      const id = await createDoc(kind, guard.userId);
      return NextResponse.json({ ok: true, id });
    }
    if (action === "duplicate") {
      const id = await duplicateDoc(Number(body?.id), guard.userId);
      if (id == null) return NextResponse.json({ error: "הפריט לא נמצא." }, { status: 404 });
      return NextResponse.json({ ok: true, id });
    }
    if (action === "createPrep") {
      const exam = await getDoc(Number(body?.examId));
      if (!exam || exam.kind !== "exam") return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
      if (exam.prepId != null) return NextResponse.json({ ok: true, id: exam.prepId });
      const id = await createDoc("prep", guard.userId, {
        title: exam.title ? `דף הכנה: ${exam.title}` : "",
      });
      await setPrepLink(exam.id, id);
      return NextResponse.json({ ok: true, id });
    }
    if (action === "linkGuide") {
      const prep = await getDoc(Number(body?.id));
      if (!prep || prep.kind !== "prep") return NextResponse.json({ error: "הדף לא נמצא." }, { status: 404 });
      let examId: number | null = null;
      if (body?.examId != null) {
        const exam = await getDoc(Number(body.examId));
        if (!exam || exam.kind !== "exam") return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
        examId = exam.id;
      }
      await setGuideExamLink(prep.id, examId);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "פעולה לא מוכרת."}, { status: 400 });
  } catch (e) {
    console.error("exams POST failed", e);
    return NextResponse.json({ error: "שגיאה בחיבור. נסו שוב." }, { status: 500 });
  }
}
