import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { saveSummaryField, summaryContextForExam } from "@/lib/exam-summaries";
import { isSummaryField, maxLenFor } from "@/lib/exam-summary-types";

// Student: autosave one summary field. Summaries are private to the student
// (the teachers read them in the dashboard); nothing here grades or checks.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  const { id } = await params;
  const ctx = await summaryContextForExam(Number(id));
  if (!ctx) return NextResponse.json({ error: "אזור הסיכומים עוד לא נפתח." }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const unitKey = String(body?.unit ?? "");
  const field = body?.field;
  const value = typeof body?.value === "string" ? body.value : null;
  if (!ctx.units.some((u) => u.key === unitKey) || !isSummaryField(field) || value == null) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }
  if (value.length > maxLenFor(field)) {
    return NextResponse.json({ error: "הטקסט ארוך מדי." }, { status: 400 });
  }
  await saveSummaryField(ctx.exam.id, Number(user.id), unitKey, field, value);
  return NextResponse.json({ ok: true });
}
