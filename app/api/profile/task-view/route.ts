import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTaskView, setUserTaskView } from "@/lib/task-view";

// Save the worksheet layout (slides / full page) on the signed-in account.
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const view = body?.view;
  if (!isTaskView(view)) {
    return NextResponse.json({ error: "ערך לא תקין." }, { status: 400 });
  }
  await setUserTaskView(Number(user.id), view);
  return NextResponse.json({ ok: true });
}
