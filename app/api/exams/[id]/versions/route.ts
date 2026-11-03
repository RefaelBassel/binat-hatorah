import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { listVersions, restoreVersion } from "@/lib/exams";

// Teacher only: version history ("החזרה לגרסה קודמת").
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  return NextResponse.json({ versions: await listVersions(Number(id)) });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const res = await restoreVersion(Number(id), Number(body?.versionId));
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 404 });
  return NextResponse.json({ ok: true, title: res.title, doc: res.doc });
}
