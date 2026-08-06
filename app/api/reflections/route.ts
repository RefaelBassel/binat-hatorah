import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function clamp(v: unknown): number {
  return Math.min(10, Math.max(1, Math.round(Number(v))));
}

// Save a reflection. Context (task, chapter, time) is captured automatically
// by the drawer and stored with full metadata.
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const difficulty = clamp(body?.difficulty);
  const pshat = clamp(body?.pshatProgress);
  const argument = clamp(body?.argumentProgress);
  const note = body?.note ? String(body.note).slice(0, 4000) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const contextRef = body?.contextRef ? String(body.contextRef).slice(0, 300) : null;

  await db().execute({
    sql: `INSERT INTO reflections
            (user_id, task_id, context_ref, difficulty, pshat_progress, argument_progress, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [Number(user.id), taskId, contextRef, difficulty, pshat, argument, note, now()],
  });
  return NextResponse.json({ ok: true });
}
