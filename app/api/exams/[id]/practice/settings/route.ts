import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import {
  getPracticeState,
  sanitizeSettings,
  savePracticeSettings,
  setPracticeOpen,
  suggestCards,
} from "@/lib/practice";

// Teacher: the practice settings of an exam (issue #34) — units, flash cards,
// open questions — and opening / closing the practice to students.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await requireTeacher();
  if (!t.ok) return t.res;
  const { id } = await params;
  const state = await getPracticeState(Number(id));
  if (!state) return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const settings = sanitizeSettings(body?.settings);
  if (!settings) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  await savePracticeSettings(state.exam.id, settings);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const t = await requireTeacher();
  if (!t.ok) return t.res;
  const { id } = await params;
  const state = await getPracticeState(Number(id));
  if (!state) return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  if (body?.action === "open" || body?.action === "close") {
    await setPracticeOpen(state.exam.id, body.action === "open");
    return NextResponse.json({ ok: true, open: body.action === "open" });
  }

  if (body?.action === "suggest-cards") {
    const units = Array.isArray(body.units) ? body.units.map(String) : state.settings.units;
    try {
      const cards = await suggestCards(units.slice(0, 20));
      if (cards.length === 0) return NextResponse.json({ error: "לא נמצאו מקורות ביחידות שנבחרו." }, { status: 400 });
      return NextResponse.json({ cards });
    } catch (err) {
      console.error("suggest cards failed", err);
      return NextResponse.json({ error: "קלוד לא הצליח להכין כרטיסיות כרגע. נסו שוב." }, { status: 500 });
    }
  }
  return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
}
