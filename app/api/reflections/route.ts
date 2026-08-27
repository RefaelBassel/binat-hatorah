import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// Read reflections for the live trend charts.
//   GET /api/reflections               → the caller's own series
//   GET /api/reflections?scope=class   → every student's series (teacher only)
export async function GET(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const scope = new URL(req.url).searchParams.get("scope");

  if (scope === "class") {
    if (user.role !== "teacher") {
      return NextResponse.json({ error: "גישת מורה בלבד." }, { status: 403 });
    }
    const res = await db().execute({
      sql: `SELECT u.id, u.full_name, u.email, r.difficulty, r.pshat_progress,
                   r.argument_progress, r.note, r.context_ref, r.created_at
            FROM reflections r JOIN users u ON u.id = r.user_id
            WHERE u.role = 'student'
            ORDER BY r.created_at ASC`,
      args: [],
    });
    const byStudent = new Map<
      number,
      { id: number; name: string; points: unknown[] }
    >();
    for (const r of res.rows) {
      const id = Number(r.id);
      if (!byStudent.has(id)) {
        byStudent.set(id, {
          id,
          name: (r.full_name as string | null) ?? String(r.email),
          points: [],
        });
      }
      byStudent.get(id)!.points.push({
        t: Number(r.created_at),
        difficulty: Number(r.difficulty),
        pshat: Number(r.pshat_progress),
        argument: Number(r.argument_progress),
        note: (r.note as string | null) ?? null,
        contextRef: (r.context_ref as string | null) ?? null,
      });
    }
    return NextResponse.json({ ok: true, students: [...byStudent.values()] });
  }

  const res = await db().execute({
    sql: `SELECT difficulty, pshat_progress, argument_progress, note, context_ref, created_at
          FROM reflections WHERE user_id = ? ORDER BY created_at ASC`,
    args: [Number(user.id)],
  });
  return NextResponse.json({
    ok: true,
    points: res.rows.map((r) => ({
      t: Number(r.created_at),
      difficulty: Number(r.difficulty),
      pshat: Number(r.pshat_progress),
      argument: Number(r.argument_progress),
      note: (r.note as string | null) ?? null,
      contextRef: (r.context_ref as string | null) ?? null,
    })),
  });
}

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
