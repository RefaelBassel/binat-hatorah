import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Guard for the notebook APIs: a signed-in, non-guest account, acting only on
// its OWN notebook (the id always comes from the session, never the request).
export async function requireNotebookUser(): Promise<
  { ok: true; userId: number } | { ok: false; res: NextResponse }
> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return { ok: false, res: NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 }) };
  }
  return { ok: true, userId: Number(user.id) };
}
