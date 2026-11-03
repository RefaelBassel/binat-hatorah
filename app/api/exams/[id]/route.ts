import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { deleteExam, saveExam } from "@/lib/exams";

// Teacher only: save the document (autosave and the manual save button).
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  const res = await saveExam(Number(id), {
    title: typeof body.title === "string" ? body.title : "",
    doc: body.doc,
    forceVersion: body.manual === true,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: res.updatedAt });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const res = await deleteExam(Number(id));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
