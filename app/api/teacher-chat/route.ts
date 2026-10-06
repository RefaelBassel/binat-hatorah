import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { requireTeacher } from "@/lib/api-auth";
import { applyAction, chatTurn, dismissAction, loadChat, newThread, refreshCodeRequests, undoAction } from "@/lib/teacher-chat";

// The teacher's chat with Claude. Teachers only.
// GET  → history, action cards, code requests (statuses refreshed)
// POST { text }                       → one turn (Claude may propose actions)
// POST { newThread: true }            → start a fresh conversation
// POST { action: id, do: "apply" | "dismiss" | "undo" }
export const maxDuration = 120;

export async function GET(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const which = Number(new URL(req.url).searchParams.get("thread") ?? "") || null;
  const data = await loadChat(guard.userId, which);
  const codeRequests = await refreshCodeRequests(guard.userId).catch(() => data.codeRequests);
  return NextResponse.json({ ok: true, ...data, codeRequests, github: Boolean(process.env.GITHUB_TOKEN) });
}

export async function POST(req: Request) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const body = await req.json().catch(() => ({}));
  try {
    if (body?.newThread === true) {
      await newThread(guard.userId);
      return NextResponse.json({ ok: true, ...(await loadChat(guard.userId)) });
    }
    if (body?.action != null) {
      const id = Number(body.action);
      const what = String(body.do);
      if (what === "apply") return NextResponse.json({ ok: true, action: await applyAction(id, guard.userId) });
      if (what === "undo") return NextResponse.json({ ok: true, action: await undoAction(id, guard.userId) });
      if (what === "dismiss") {
        await dismissAction(id, guard.userId);
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ error: "פעולה לא ידועה" }, { status: 400 });
    }
    const text = String(body?.text ?? "").trim().slice(0, 8000);
    if (!text) return NextResponse.json({ error: "כתבי משהו" }, { status: 400 });
    const session = await auth();
    const result = await chatTurn(guard.userId, session?.user?.fullName ?? null, text);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "משהו השתבש" }, { status: 500 });
  }
}
