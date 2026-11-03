import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { listVersions, restoreVersion } from "@/lib/exams";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  return NextResponse.json({ versions: await listVersions(Number(id)) });
}

// Restore a version (the current text is kept as a version first).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { versionId?: unknown } | null;
  const data = await restoreVersion(Number(id), Number(body?.versionId));
  if (!data) return NextResponse.json({ error: "הגרסה לא נמצאה." }, { status: 404 });
  return NextResponse.json({ ok: true, ...data });
}
