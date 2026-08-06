import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import WritingSpace from "@/components/writing/writing-space";
import { WRITING_LEVELS } from "@/content/writing/exercises";
import { db } from "@/lib/db";

export default async function WritingPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");

  // existing results for this student
  const results: Record<string, { score: number | null; feedback: string | null }> = {};
  if (!user.guest) {
    try {
      const res = await db().execute({
        sql: "SELECT exercise_key, score, claude_feedback FROM writing_results WHERE user_id = ?",
        args: [Number(user.id)],
      });
      for (const r of res.rows) {
        results[String(r.exercise_key)] = {
          score: r.score != null ? Number(r.score) : null,
          feedback: (r.claude_feedback as string | null) ?? null,
        };
      }
    } catch {
      // DB unavailable
    }
  }

  return (
    <PageShell
      title="תרגול כתיבה טיעונית"
      subtitle="לומדות לבנות, לפרק ולהעריך טיעונים — המיומנות שמלווה אותנו בתנ״ך, בדיבייט ובחיים"
    >
      <div className="mx-auto max-w-4xl">
        {/* the skill explainer */}
        <section className="mb-10 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="mb-3 font-display text-lg font-bold text-[color:var(--primary)]">
            🧠 מה זה בכלל טיעון?
          </h2>
          <p className="mb-4 max-w-3xl text-sm leading-7 text-[color:var(--foreground)]/80">
            בכל מקום שבו אנשים מנסים לשכנע — בכיתה, בבית, בפוליטיקה וגם בתנ״ך —
            הם בונים <b>טיעון</b>. טיעון טוב בנוי מארבעה מרכיבים, אבל שימי לב:
            אנשים לא תמיד אומרים אותם לפי הסדר, ולפעמים הם מבליעים מרכיבים
            שלמים בלי לומר אותם בקול. מי שיודעת לזהות את המרכיבים — יודעת גם
            לגלות איפה הטיעון חזק ואיפה הוא רעוע.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { emoji: "📌", title: "טענה", body: "השורה התחתונה — מה בעצם רוצים לשכנע אותי לחשוב או לעשות?" },
              { emoji: "🧱", title: "נימוק / ראיה", body: "ההוכחה — עובדה, מקור או היגיון שתומכים בטענה." },
              { emoji: "🔍", title: "הנחת יסוד", body: "מה שמניחים בשקט מתחת לפני השטח — לרוב בלי לומר." },
              { emoji: "✅", title: "מסקנה", body: "מה שנובע מהכול — האם היא באמת נובעת לוגית?" },
            ].map((c) => (
              <div key={c.title} className="rounded-xl bg-[color:var(--background)] p-4">
                <p className="text-xl">{c.emoji}</p>
                <p className="font-display text-sm font-bold text-[color:var(--primary)]">{c.title}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--foreground)]/70">{c.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-xl bg-[color:var(--accent)]/10 px-4 py-3 text-xs leading-6 text-[color:var(--foreground)]/75">
            💪 <b>איך מעריכים טיעון?</b> בודקים כל מרכיב בנפרד: האם הנחות היסוד
            חזקות או רעועות? האם הנימוקים והראיות משכנעים או חלשים? והאם המסקנה
            באמת נובעת מהם — או שהיא קופצת רחוק מדי?
          </p>
        </section>

        <WritingSpace levels={WRITING_LEVELS} initialResults={results} />
      </div>
    </PageShell>
  );
}
