import { NextResponse } from "next/server";
import { pendingProposalsForCron, proposeGrade } from "@/lib/grade-assist";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

// stop picking up new work well before the function limit
const BUDGET_MS = 600_000;

// Vercel cron (vercel.json): prepares Claude's grade proposal for every
// submitted work that has none — submissions from before automatic grading,
// and any run cut off after a submission. One at a time, oldest first.
// Vercel sends `Authorization: Bearer $CRON_SECRET` with every cron call.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  const queue = await pendingProposalsForCron(20);
  let done = 0;
  let failed = 0;
  for (const { taskId, userId } of queue) {
    if (Date.now() - started > BUDGET_MS) break;
    const result = await proposeGrade(taskId, userId);
    if (result.ok) done += 1;
    else failed += 1;
  }
  return NextResponse.json({ ok: true, queued: queue.length, done, failed });
}
