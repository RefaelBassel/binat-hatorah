import { NextResponse, after } from "next/server";
import { requireTeacher } from "@/lib/api-auth";
import { setTaskLang, translateContent } from "@/lib/task-lang";

export const maxDuration = 800;

// POST { userId, lang: "he" | "en" } — teacher only. Switching a student to
// English also translates every published task in the background, so her
// first visit to each task opens without waiting.
export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => null);
  const userId = Number(body?.userId);
  const lang = body?.lang === "en" ? "en" : "he";
  if (!userId) return NextResponse.json({ error: "חסר תלמיד" }, { status: 400 });
  await setTaskLang(userId, lang);
  if (lang === "en") after(() => warmAll().catch((e) => console.error("translation warm-up failed", e)));
  return NextResponse.json({ ok: true, lang });
}

async function warmAll() {
  const { db } = await import("@/lib/db");
  const { getTaskContent } = await import("@/content/tasks/registry");
  const { effectiveContent } = await import("@/lib/content-overrides");
  const { uiDictionary } = await import("@/lib/task-lang");
  const { TASK_UI_STRINGS, SITE_UI_STRINGS } = await import("@/lib/task-ui-strings");
  await uiDictionary([...TASK_UI_STRINGS, ...SITE_UI_STRINGS]);
  const r = await db().execute("SELECT DISTINCT content_ref FROM tasks WHERE published_at IS NOT NULL");
  for (const row of r.rows) {
    const reg = getTaskContent(String(row.content_ref));
    if (reg) await translateContent(await effectiveContent(reg.content));
  }
}
