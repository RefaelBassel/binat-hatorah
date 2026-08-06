import { NextResponse } from "next/server";
import { auth, updateSession } from "@/auth";
import { db } from "@/lib/db";

// Update profile preferences — currently the form of address (גוף הפנייה).
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const addressForm = String(body?.addressForm ?? "");
  if (!["f", "m", "neutral"].includes(addressForm)) {
    return NextResponse.json({ error: "ערך לא תקין." }, { status: 400 });
  }
  await db().execute({
    sql: "UPDATE users SET address_form = ? WHERE id = ?",
    args: [addressForm, Number(user.id)],
  });
  await updateSession({ user: { addressForm } });
  return NextResponse.json({ ok: true });
}
