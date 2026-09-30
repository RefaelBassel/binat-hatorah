import { NextResponse } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { getTaskContent } from "@/content/tasks/registry";
import {
  EDITABLE_FIELDS,
  EMPTY_UNIT,
  clearOverride,
  getOverrides,
  sanitizeField,
  setOverride,
  type EditableField,
} from "@/lib/content-overrides";

// Teacher in-place edits of task content (check, open question, plenary,
// opening deck). Teachers only — students never reach this route and never
// see the edit affordance (decided server-side on every page).
export async function PUT(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  const contentRef = typeof body?.contentRef === "string" ? body.contentRef : "";
  const field = body?.field as EditableField;
  const reg = getTaskContent(contentRef);
  if (!reg) {
    return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  }
  if (!EDITABLE_FIELDS.includes(field)) {
    return NextResponse.json({ error: "שדה לא ידוע." }, { status: 400 });
  }
  if (body?.reset === true) {
    await clearOverride(contentRef, field);
    return NextResponse.json({ ok: true, value: (reg.content as unknown as Record<string, unknown>)[field] ?? null, reset: true });
  }
  // the deck's title slide edits only the unit's title line: merge it into
  // whatever unit edits already exist instead of replacing them
  let rawValue = body?.value;
  if (field === "unit" && body?.merge === true) {
    const existing = (await getOverrides(contentRef)).unit ?? EMPTY_UNIT;
    rawValue = { ...existing, ...(rawValue && typeof rawValue === "object" ? rawValue : {}), sections: existing.sections, blocks: existing.blocks };
  }
  const value = sanitizeField(field, rawValue);
  if (value == null) {
    return NextResponse.json(
      {
        error:
          "התוכן לא תקין — בדקו שכל שאלה כוללת נוסח, לפחות שתי אפשרויות ותשובה נכונה.",
      },
      { status: 400 }
    );
  }
  await setOverride(contentRef, field, value, guard.userId);
  return NextResponse.json({ ok: true, value });
}
