import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { answerToHebrew } from "@/lib/task-lang";

export const maxDuration = 120;

// POST { text } — teacher only: a student's English answer in Hebrew (cached)
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  const text = String(body?.text ?? "").trim().slice(0, 8000);
  if (!text) return NextResponse.json({ error: "אין טקסט" }, { status: 400 });
  try {
    return NextResponse.json({ ok: true, he: await answerToHebrew(text) });
  } catch (e) {
    console.error("answer translation failed", e);
    return NextResponse.json({ error: "התרגום נכשל — נסי שוב" }, { status: 502 });
  }
}
