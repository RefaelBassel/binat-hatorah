import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/api-auth";
import { getDoc, setPublished } from "@/lib/exams";
import { israelWallTimeToUnix } from "@/lib/hebrew";

// Publish / unpublish. A prep sheet becomes a reading page for students; an
// exam also needs its opening date and time.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const doc = await getDoc(Number(id));
  if (!doc) return NextResponse.json({ error: "הפריט לא נמצא." }, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const publish = body?.publish === true;
  let opensAt: number | null = null;
  if (publish && doc.kind === "exam") {
    const date = String(body?.opensDate ?? "");
    const time = String(body?.opensTime ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json({ error: "יש לבחור תאריך ושעת פתיחה." }, { status: 400 });
    }
    if (!doc.durationMin) {
      return NextResponse.json({ error: "יש להגדיר זמן מבחן לפני הפרסום." }, { status: 400 });
    }
    opensAt = israelWallTimeToUnix(date, time);
  }
  try {
    await setPublished(doc.id, publish, opensAt);
    revalidatePath("/exams");
    revalidatePath("/dashboard/exams");
    return NextResponse.json({ ok: true, publishedAt: publish ? Math.floor(Date.now() / 1000) : null, opensAt });
  } catch (e) {
    console.error("exam publish failed", e);
    return NextResponse.json({ error: "שגיאה בחיבור. נסו שוב." }, { status: 500 });
  }
}
