import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireNotebookUser } from "@/lib/notebook-auth";
import { getOrCreateToday, listEntries, listNotebookUnits, translateUnitLabels, unitsWithEntries } from "@/lib/notebook";

export const dynamic = "force-dynamic";

// GET ?unit=<key> — the signed-in student's own entries (newest first) with
// the unit list. Used by the side panel and the exam-summary import.
export async function GET(req: Request) {
  const guard = await requireNotebookUser();
  if (!guard.ok) return guard.res;
  const unit = new URL(req.url).searchParams.get("unit") ?? undefined;
  const [entries, units] = await Promise.all([listEntries(guard.userId, unit), listNotebookUnits()]);
  const { isEnglishStudent } = await import("@/lib/task-lang");
  const english = await isEnglishStudent((await auth())?.user);
  const all = unitsWithEntries(units, entries);
  return NextResponse.json({
    entries,
    units: english ? await translateUnitLabels(all) : all,
    lang: english ? "en" : "he",
  });
}

// POST { unitKey? } — today's entry: created on first use, opened afterwards.
export async function POST(req: Request) {
  const guard = await requireNotebookUser();
  if (!guard.ok) return guard.res;
  const body = (await req.json().catch(() => null)) as { unitKey?: unknown } | null;
  let unitKey = typeof body?.unitKey === "string" ? body.unitKey : "";
  if (unitKey && !(await listNotebookUnits()).some((u) => u.key === unitKey)) unitKey = "";
  const { entry, created } = await getOrCreateToday(guard.userId, unitKey);
  return NextResponse.json({ entry, created });
}
