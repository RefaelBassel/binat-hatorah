import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { blankSlides, createDeck, deckForExam } from "@/lib/decks";

// Teacher-only: open (or create) the deck of an exam, or create a general deck.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  try {
    if (body.action === "exam") {
      const id = await deckForExam(Number(body.examId));
      if (id == null) return NextResponse.json({ error: "המבחן לא נמצא." }, { status: 404 });
      return NextResponse.json({ id });
    }
    if (body.action === "create") {
      const id = await createDeck("מצגת חדשה", null, blankSlides());
      return NextResponse.json({ id });
    }
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  } catch (e) {
    console.error("deck create failed", e);
    return NextResponse.json({ error: "לא הצליח. נסו שוב." }, { status: 500 });
  }
}
