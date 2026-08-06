import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireStudentTask } from "@/lib/api-auth";
import { now } from "@/lib/tasks";

const KINDS = new Set(["leitwort", "hard", "parallel", "question"]);

// Toggle a word marking (add or remove).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;

  const body = await req.json().catch(() => null);
  const passageKey = String(body?.passageKey ?? "").slice(0, 60);
  const wordIndex = Number(body?.wordIndex);
  const wordText = String(body?.wordText ?? "").slice(0, 100);
  const kind = String(body?.kind ?? "");
  const note = body?.note ? String(body.note).slice(0, 2000) : null;
  const remove = Boolean(body?.remove);

  if (!passageKey || !Number.isInteger(wordIndex) || !KINDS.has(kind)) {
    return NextResponse.json({ error: "בקשה לא תקינה." }, { status: 400 });
  }

  if (remove) {
    await db().execute({
      sql: `DELETE FROM text_markings
            WHERE task_id = ? AND user_id = ? AND passage_key = ? AND word_index = ? AND kind = ?`,
      args: [guard.task.id, guard.userId, passageKey, wordIndex, kind],
    });
  } else {
    await db().execute({
      sql: `INSERT INTO text_markings
              (task_id, user_id, passage_key, word_index, word_text, kind, note, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(task_id, user_id, passage_key, word_index, kind)
            DO UPDATE SET note = excluded.note`,
      args: [guard.task.id, guard.userId, passageKey, wordIndex, wordText, kind, note, now()],
    });
  }
  return NextResponse.json({ ok: true });
}
