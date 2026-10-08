import { NextResponse } from "next/server";
import { refreshCodeRequests } from "@/lib/teacher-chat";

export const dynamic = "force-dynamic";

// Vercel cron (vercel.json): flushes the teacher-chat code-request queue
// every ten minutes, so a request the teacher made while another was being
// built goes out even if nobody opens the site afterwards. Vercel sends
// `Authorization: Bearer $CRON_SECRET` with every cron call.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const list = await refreshCodeRequests(0);
  return NextResponse.json({ ok: true, at: new Date().toISOString(), seen: list.length });
}
