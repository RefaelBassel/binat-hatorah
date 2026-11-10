import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { parseSlides } from "@/lib/deck-types";
import { ensureStudentDeck, saveStudentDeck, setStudentDeckPublished, syncStudentDeck } from "@/lib/student-decks";

// Teacher-only: the student copy of an exam's review presentation (issue #53).

type Ctx = { params: Promise<{ examId: string }> };

async function load(ctx: Ctx) {
  const guard = await requireTeacher();
  if (!guard.ok) return { res: guard.res } as const;
  const { examId } = await ctx.params;
  const deck = await ensureStudentDeck(Number(examId));
  if (!deck) return { res: NextResponse.json({ error: "המצגת לא נמצאה." }, { status: 404 }) } as const;
  return { deck } as const;
}

// autosave of the copy's own edits
export async function PUT(req: Request, ctx: Ctx) {
  const l = await load(ctx);
  if ("res" in l) return l.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  try {
    await saveStudentDeck(l.deck.examId, String(body.title ?? "").slice(0, 300), parseSlides(body.slides));
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("student deck save failed", e);
    return NextResponse.json({ error: "לא נשמר. בדקו את החיבור." }, { status: 500 });
  }
}

// "עדכון מהמצגת שלי": re-copies the slides from the teacher's deck
export async function POST(req: Request, ctx: Ctx) {
  const l = await load(ctx);
  if ("res" in l) return l.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (body?.action !== "sync") return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  try {
    const slides = await syncStudentDeck(l.deck.examId);
    return NextResponse.json({ ok: true, slides });
  } catch (e) {
    console.error("student deck sync failed", e);
    return NextResponse.json({ error: "העדכון לא הצליח. נסו שוב." }, { status: 500 });
  }
}

// "פרסום לתלמידים" switch
export async function PATCH(req: Request, ctx: Ctx) {
  const l = await load(ctx);
  if ("res" in l) return l.res;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body.published !== "boolean") return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  try {
    await setStudentDeckPublished(l.deck.examId, body.published);
    return NextResponse.json({ ok: true, published: body.published });
  } catch (e) {
    console.error("student deck publish failed", e);
    return NextResponse.json({ error: "לא נשמר. נסו שוב." }, { status: 500 });
  }
}
