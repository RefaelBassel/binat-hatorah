import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireTeacher } from "@/lib/api-auth";
import { cleanTips, saveExamTips } from "@/lib/exam-tips";

// Teacher edit of the shared tips box shown on every prep sheet.
export async function PUT(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  const tips = cleanTips(body);
  if (tips.items.length > 0 && !tips.title) {
    return NextResponse.json({ error: "חסרה כותרת לתיבה." }, { status: 400 });
  }
  try {
    await saveExamTips(tips);
    revalidatePath("/exams");
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("exam tips save failed", e);
    return NextResponse.json({ error: "לא נשמר. בדקו את החיבור." }, { status: 500 });
  }
}
