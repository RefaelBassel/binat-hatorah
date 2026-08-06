import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getTask, isAssigned, type TaskRow } from "./tasks";

// Shared guard for task-scoped student APIs: session + assignment check.
export async function requireStudentTask(
  taskIdRaw: string
): Promise<
  | { ok: true; userId: number; task: TaskRow; isTeacher: boolean }
  | { ok: false; res: NextResponse }
> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return {
      ok: false,
      res: NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 }),
    };
  }
  const taskId = Number(taskIdRaw);
  const task = await getTask(taskId);
  if (!task) {
    return {
      ok: false,
      res: NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 }),
    };
  }
  const userId = Number(user.id);
  const isTeacher = user.role === "teacher";
  if (!isTeacher && !(await isAssigned(taskId, userId))) {
    return {
      ok: false,
      res: NextResponse.json({ error: "המשימה לא הוקצתה לך." }, { status: 403 }),
    };
  }
  return { ok: true, userId, task, isTeacher };
}

export async function requireTeacher(): Promise<
  { ok: true; userId: number } | { ok: false; res: NextResponse }
> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest || user.role !== "teacher") {
    return {
      ok: false,
      res: NextResponse.json({ error: "גישת מורה בלבד." }, { status: 403 }),
    };
  }
  return { ok: true, userId: Number(user.id) };
}
