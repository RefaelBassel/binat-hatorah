import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import { db } from "@/lib/db";

// תוצר א׳ infrastructure — per the annual plan. The full submission workflow
// opens after the site is deployed; the structure, stages and roles live
// here already.
export default async function ProductAPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");

  let myRole: string | null = null;
  if (!user.guest) {
    try {
      const r = await db().execute({
        sql: "SELECT role FROM product_roles WHERE product_key = 'product-a' AND user_id = ?",
        args: [Number(user.id)],
      });
      myRole = (r.rows[0]?.role as string | undefined) ?? null;
    } catch {
      // DB unavailable
    }
  }

  return (
    <PageShell
      title="תוצר א׳ — נייר עמדה"
      subtitle="ניתוח עימות קהילתי בחומש במדבר · עבודה קבוצתית · מחצית א׳ · 15% מהציון השנתי"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {myRole && (
          <div className="rounded-2xl border-2 border-[color:var(--accent)]/50 bg-[color:var(--accent)]/5 p-4 text-center">
            <p className="text-sm font-bold text-[color:var(--accent)]">
              🎭 התפקיד שלך בקבוצה: {myRole}
            </p>
          </div>
        )}

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="mb-3 font-display text-lg font-bold text-[color:var(--primary)]">
            📄 מה זה נייר עמדה?
          </h2>
          <p className="text-sm leading-7 text-[color:var(--foreground)]/80">
            בוחרים מחלוקת אחת מתוך חומש במדבר, ממפים את הטענות של{" "}
            <b>כל הצדדים</b> בשפת מיומנות הטיעון — טענות, הנחות יסוד, נימוקים
            ומסקנות — מזהים את החוזקות והכשלים של כל טיעון, וכותבים נייר עמדה
            מנומק שמציע <b>פתרון מנהיגותי-קהילתי חלופי</b>.
          </p>
        </section>

        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-[color:var(--primary)]">
            🗺️ שלבי העבודה
          </h2>
          <ol className="space-y-3">
            {[
              { emoji: "⚔️", title: "בחירת העימות", body: "עדת קרח ומחלוקתו · חטא המרגלים · תלונות המתאוננים — או עימות אחר באישור המורה." },
              { emoji: "🗂️", title: "מיפוי הטענות", body: "לכל צד: מה הטענה? מה הנימוקים והראיות? ואילו הנחות יסוד סמויות מתחת?" },
              { emoji: "🔬", title: "זיהוי חוזקות וכשלים", body: "איפה כל טיעון חזק, איפה הוא רעוע — ובאיזה מרכיב בדיוק." },
              { emoji: "✍️", title: "כתיבת נייר העמדה", body: "עמדה מנומקת + פתרון מנהיגותי-קהילתי חלופי לעימות." },
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

        <div className="rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)]/70 p-6 text-center">
          <p className="font-display text-base font-bold text-[color:var(--primary)]">
            🛠️ מרחב העבודה וההגשה ייפתח כאן
          </p>
          <p className="mt-1 text-xs leading-6 text-[color:var(--foreground)]/60">
            חלוקת הקבוצות, התפקידים, טיוטות, משוב קלוד והגשה — הכול יופיע כאן
            כשנצא לדרך במחצית א׳. ההגשה: לקראת שבט · יחד עם מבחן מחצית א׳.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
