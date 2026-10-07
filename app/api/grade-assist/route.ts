import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { proposeGrade } from "@/lib/grade-assist";

// a detailed evaluation from the model can take well over the default limit
export const maxDuration = 120;

// Teacher-triggered (re)run of the Claude grade proposal. Always answers
// with JSON — on failure { ok: false, error } so the panel can show it.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const taskId = Number(body?.taskId);
  const studentId = Number(body?.userId);
  if (!Number.isInteger(taskId) || !Number.isInteger(studentId)) {
    return NextResponse.json({ ok: false, error: "בקשה לא תקינה." }, { status: 400 });
  }

  const result = await proposeGrade(taskId, studentId);
  if (!result.ok) return NextResponse.json(result, { status: 502 });
  return NextResponse.json(result);
}
