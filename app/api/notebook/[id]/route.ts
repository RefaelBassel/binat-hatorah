import { NextResponse } from "next/server";
import { requireNotebookUser } from "@/lib/notebook-auth";
import { deleteEntry, listNotebookUnits, updateEntry, type EntryPatch } from "@/lib/notebook";
import { NOTEBOOK_BODY_MAX, NOTEBOOK_TITLE_MAX } from "@/lib/notebook-shared";

// PATCH { title?, unitKey?, body? } — autosave. Only the owner can write, and
// the entry's date is never changed.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireNotebookUser();
  if (!guard.ok) return guard.res;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!raw) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });

  const patch: EntryPatch = {};
  if (raw.title !== undefined) {
    if (typeof raw.title !== "string" || raw.title.length > NOTEBOOK_TITLE_MAX) {
      return NextResponse.json({ error: "הכותרת ארוכה מדי." }, { status: 400 });
    }
    patch.title = raw.title;
  }
  if (raw.body !== undefined) {
    if (typeof raw.body !== "string" || raw.body.length > NOTEBOOK_BODY_MAX) {
      return NextResponse.json({ error: "הטקסט ארוך מדי." }, { status: 400 });
    }
    patch.body = raw.body;
  }
  if (raw.unitKey !== undefined) {
    if (typeof raw.unitKey !== "string") return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
    if (raw.unitKey && !(await listNotebookUnits()).some((u) => u.key === raw.unitKey)) {
      return NextResponse.json({ error: "היחידה לא נמצאה." }, { status: 400 });
    }
    patch.unitKey = raw.unitKey;
  }

  const entry = await updateEntry(id, guard.userId, patch);
  if (!entry) return NextResponse.json({ error: "הרשומה לא נמצאה." }, { status: 404 });
  return NextResponse.json({ ok: true, updatedAt: entry.updatedAt });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireNotebookUser();
  if (!guard.ok) return guard.res;
  const id = Number((await params).id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  const ok = await deleteEntry(id, guard.userId);
  if (!ok) return NextResponse.json({ error: "הרשומה לא נמצאה." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
