import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { deleteDeck, getDeck, saveDeck } from "@/lib/decks";
import { parseSlides } from "@/lib/deck-types";

// Teacher autosave of a deck.
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const deck = await getDeck(Number(id));
  if (!deck) return NextResponse.json({ error: "המצגת לא נמצאה." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  const title = String(body.title ?? "").slice(0, 300);
  try {
    await saveDeck(deck.id, title, parseSlides(body.slides));
    return NextResponse.json({ ok: true, savedAt: Math.floor(Date.now() / 1000) });
  } catch (e) {
    console.error("deck save failed", e);
    return NextResponse.json({ error: "לא נשמר. בדקו את החיבור." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const deck = await getDeck(Number(id));
  if (!deck) return NextResponse.json({ error: "המצגת לא נמצאה." }, { status: 404 });
  try {
    await deleteDeck(deck.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("deck delete failed", e);
    return NextResponse.json({ error: "לא נמחק. נסו שוב." }, { status: 500 });
  }
}
