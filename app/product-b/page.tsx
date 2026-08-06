import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import { db } from "@/lib/db";

// תוצר ב׳ infrastructure — PBL research project per the annual plan, plus
// the mini-seminar (third product) growing from the personal question bank.
export default async function ProductBPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");

  let myRole: string | null = null;
  let chosenQuestion: string | null = null;
  if (!user.guest) {
    try {
      const r = await db().execute({
        sql: "SELECT role FROM product_roles WHERE product_key = 'product-b' AND user_id = ?",
        args: [Number(user.id)],
      });
      myRole = (r.rows[0]?.role as string | undefined) ?? null;
      const q = await db().execute({
        sql: "SELECT question FROM question_bank WHERE user_id = ? AND chosen_for_seminar = 1 LIMIT 1",
        args: [Number(user.id)],
      });
      chosenQuestion = (q.rows[0]?.question as string | undefined) ?? null;
    } catch {
      // DB unavailable
    }
  }

  return (
    <PageShell
      title="תוצר ב׳ — עבודת חקר"
      subtitle="״אחריות קהילתית: מתנ״ך לאקטואליה״ · PBL אישי/בזוגות · מחצית ב׳ · 15% מהציון · שיא: תערוכת תוצרים"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {myRole && (
          <div className="rounded-2xl border-2 border-[color:var(--accent)]/50 bg-[color:var(--accent)]/5 p-4 text-center">
            <p className="text-sm font-bold text-[color:var(--accent)]">
              🎭 התפקיד שלך: {myRole}
            </p>
          </div>
        )}

        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-[color:var(--primary)]">
            🔬 שלבי החקר
          </h2>
          <ol className="space-y-3">
            {[
              { emoji: "🏘️", title: "זיהוי בעיה קהילתית", body: "סוגיה חברתית אמיתית ואקטואלית: יחס למיעוטים ולחלשים, צדק חלוקתי בעיר, איכות סביבה, לכידות חברתית..." },
              { emoji: "📜", title: "ניתוח מקור תנ״כי מקביל", body: "לימוד מעמיק של מקרה מקביל מתוך התוכנית (במדבר / מלכים) — בכלי פענוח הפשט שלנו." },
              { emoji: "⚖️", title: "מיפוי וניסוח טיעון", body: "הצגת הטענות השונות סביב הבעיה וגיבוש טענה מורכבת ומנומקת שלך." },
              { emoji: "💡", title: "הצעה מעשית", body: "פתרון קהילתי ישים — לא רק ניתוח, גם מעשה." },
              { emoji: "🎪", title: "תערוכת התוצרים (Exhibition)", body: "מציגות את העבודה מול קהל — ההצגה עצמה מוערכת בשפת מיומנות הטיעון." },
            ].map((s, i) => (
              <li key={s.title} className="flex gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color:var(--primary)]/8 text-lg">
                  {s.emoji}
                </span>
                <div>
                  <p className="font-display text-sm font-bold text-[color:var(--primary)]">
                    שלב {i + 1} · {s.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-6 text-[color:var(--foreground)]/70">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            🎨 פורמט התוצר — בחירה דיפרנציאלית
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { emoji: "📑", label: "נייר מדיניות" },
              { emoji: "🎙️", label: "פודקאסט" },
              { emoji: "🖼️", label: "פוסטר אקדמי" },
              { emoji: "🎬", label: "סרטון קצר" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-[color:var(--background)] p-4 text-center">
                <p className="text-2xl">{f.emoji}</p>
                <p className="mt-1 text-xs font-bold text-[color:var(--primary)]">{f.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* the third product — mini seminar */}
        <section className="rounded-2xl border-2 border-[color:var(--primary)]/25 bg-[color:var(--card)] p-6">
          <h2 className="mb-2 font-display text-base font-bold text-[color:var(--primary)]">
            🌟 והתוצר השלישי: המיני-סמינריון שלך
          </h2>
          <p className="text-sm leading-7 text-[color:var(--foreground)]/80">
            כל שאלה שאת שואלת במהלך השנה נאספת ל<b>מאגר השאלות האישי</b> שלך.
            לקראת סוף השנה תבחרי ממנו <b>שאלה אחת</b> שמסקרנת אותך באמת — והיא
            תהפוך לעבודת חקר אישית קטנה.
          </p>
          {chosenQuestion ? (
            <p className="mt-3 rounded-xl bg-[color:var(--accent)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--accent)]">
              🌟 השאלה שבחרת: {chosenQuestion}
            </p>
          ) : (
            <p className="mt-3 text-xs text-[color:var(--primary)]/55">
              עוד לא בחרת שאלה —{" "}
              <Link href="/me" className="font-bold text-[color:var(--accent)] underline-offset-2 hover:underline">
                למאגר השאלות שלך בעמוד האישי ←
              </Link>
            </p>
          )}
        </section>

        <div className="rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)]/70 p-6 text-center">
          <p className="font-display text-base font-bold text-[color:var(--primary)]">
            🛠️ מרחב החקר וההגשה ייפתח כאן
          </p>
          <p className="mt-1 text-xs leading-6 text-[color:var(--foreground)]/60">
            ניסוח שאלת החקר, הטיוטות, המשוב וההגשה — יופיעו כאן עם התנעת תוצר
            ב׳ (אדר–ניסן). התערוכה והמבחן: סיון–תמוז.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
