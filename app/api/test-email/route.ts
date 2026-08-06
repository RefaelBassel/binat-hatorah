import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendEmail } from "@/lib/email";

// Teacher-only: send a test email to the signed-in teacher's own address to
// verify the RESEND_API_KEY / EMAIL_FROM configuration end to end.
export async function POST() {
  const session = await auth();
  const user = session?.user;
  if (!user?.email || user.guest || user.role !== "teacher") {
    return NextResponse.json({ error: "למורות בלבד." }, { status: 403 });
  }
  const ok = await sendEmail({
    to: user.email,
    subject: "בדיקת מערכת המייל — בינת התורה",
    html: `<div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7">
      <h2 style="color:#413055">מערכת המייל עובדת ✅</h2>
      <p>זהו מייל בדיקה מאתר <b>בינת התורה</b>. אם הוא הגיע — ההגדרות של Resend תקינות,
      והתראות המייל (הגשות, איחורים, ציונים) יישלחו כרגיל.</p>
    </div>`,
  });
  return NextResponse.json({ ok });
}
