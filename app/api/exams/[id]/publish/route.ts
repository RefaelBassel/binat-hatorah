import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { publishExam, unpublishExam } from "@/lib/exams";
import { israelWallTimeToUnix } from "@/lib/hebrew";

// Teacher only: publish to students / take back to draft. Nothing is
// published unless this is called — the default is a draft.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (body.action === "unpublish") {
    const res = await unpublishExam(Number(id));
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  let opensAt: number | null = null;
  const date = typeof body.opensDate === "string" ? body.opensDate : "";
  const time = typeof body.opensTime === "string" ? body.opensTime : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
    opensAt = israelWallTimeToUnix(date, time);
  }
  const durationMin =
    body.durationMin === undefined || body.durationMin === null || body.durationMin === ""
      ? null
      : Math.round(Number(body.durationMin));
  const res = await publishExam(Number(id), {
    opensAt,
    durationMin: durationMin !== null && Number.isFinite(durationMin) ? durationMin : null,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
