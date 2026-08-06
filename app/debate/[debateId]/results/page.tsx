import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { getDebate, getQuestions, questionResults, VOTE_AXES } from "@/lib/debate";

// Results summary in site chrome (the projector shows the dark FinalBoard;
// this page is for students' phones and later review).
export default async function DebateResultsPage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { debateId } = await params;
  const debate = await getDebate(Number(debateId));
  if (!debate) notFound();
  const questions = await getQuestions(debate.id);

  const results = await Promise.all(
    questions.map(async (q) => ({ q, r: await questionResults(q.id) }))
  );

  return (
    <PageShell title="🏆 תוצאות הדיבייט" subtitle={debate.title}>
      <div className="mx-auto max-w-2xl space-y-5">
        {results.map(({ q, r }) => {
          const winner =
            r.n === 0 || Math.abs(r.total) < 0.35
              ? null
              : r.total < 0
                ? q.groupA
                : q.groupB;
          return (
            <div key={q.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
              <p className="text-sm font-bold text-[color:var(--primary)]">
                {q.orderIdx}. {q.question}
              </p>
              <p className="mt-1 text-lg font-extrabold text-[color:var(--success)]">
                {winner ? `🏅 המנצחת: ${winner}` : r.n === 0 ? "טרם התקבלו הצבעות" : "🤝 תיקו — שקול!"}
                {r.n > 0 && (
                  <span className="ms-2 text-xs font-normal text-[color:var(--primary)]/50">
                    ({r.n} הצבעות)
                  </span>
                )}
              </p>
              {r.n > 0 && (
                <div className="mt-3 space-y-2">
                  {VOTE_AXES.map((ax, i) => {
                    const v = r.axes[i];
                    const pct = ((v + 2) / 4) * 100;
                    return (
                      <div key={ax.key} className="text-xs">
                        <p className="mb-0.5 text-[color:var(--primary)]/60">{ax.label}</p>
                        <div className="flex items-center gap-2">
                          <span className="w-14 font-bold text-[#8a6516]">{q.groupA}</span>
                          <div className="relative h-2.5 flex-1 rounded-full bg-[color:var(--border)]/50">
                            <div
                              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-white shadow"
                              style={{
                                insetInlineStart: `calc(${100 - pct}% - 8px)`,
                                background: v < 0 ? "#b3892b" : v > 0 ? "#2f5d8a" : "#94897e",
                              }}
                            />
                          </div>
                          <span className="w-14 text-end font-bold text-[#2f5d8a]">{q.groupB}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        <div className="rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)]/70 p-5 text-center text-sm text-[color:var(--foreground)]/70">
          💬 לעיבוד בכיתה: אילו טיעונים שכנעו אתכן — ולמה? אילו הנחות יסוד
          נחשפו במהלך הדיבייט? מה הייתן מחזקות בטיעון של הקבוצה שלכן?
        </div>
      </div>
    </PageShell>
  );
}
