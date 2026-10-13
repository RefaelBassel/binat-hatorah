import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isTheme } from "@/lib/theme";
import { setUserTheme } from "@/lib/theme-store";

// Save the display theme (light/dark) on the signed-in user's account.
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const theme = body?.theme;
  if (!isTheme(theme)) {
    return NextResponse.json({ error: "ערך לא תקין." }, { status: 400 });
  }
  await setUserTheme(Number(user.id), theme);
  return NextResponse.json({ ok: true });
}
