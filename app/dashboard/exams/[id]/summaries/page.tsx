import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { allSummaries, summaryUnitsOfExam } from "@/lib/exam-summaries";
import { SUMMARY_FIELDS } from "@/lib/exam-summary-types";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";

export const dynamic = "force-dynamic";

// Teacher: every student's summaries for the exam. Read-only — summaries get
// no grade and no automatic check.
export default async function ExamSummariesPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const { id } = await params;
  const ctx = await summaryUnitsOfExam(Number(id));
  if (!ctx) notFound();
  const students = await allSummaries(ctx.exam.id);

  return (
    <PageShell title={`סיכומי התלמידות: ${ctx.exam.title}`} subtitle="הסיכומים נכתבים בעמוד ההכנה למבחן. אין ציון ואין בדיקה אוטומטית">
      <p className="mb-4 text-center">
        <Link href="/dashboard/exams" className="text-sm font-semibold text-[color:var(--primary)] underline">
          ← חזרה לרשימת המבחנים
        </Link>
      </p>
      <p className="mb-6 text-center text-lg font-bold">
        {students.length} תלמידות התחילו לסכם
      </p>
      {students.length === 0 && <p className="text-center">עוד אין סיכומים.</p>}
      <div className="mx-auto max-w-4xl space-y-3">
        {students.map((s) => (
          <details
            key={s.userId}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm"
          >
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-bold">
              <span>{s.name}</span>
              <span className="text-xs font-normal text-[color:var(--foreground)]/60">
                {Object.keys(s.units).length} מתוך {ctx.units.length} יחידות · עודכן {formatHebDate(s.updatedAt)}, {formatHebTime(s.updatedAt)}
              </span>
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={`/exams/summary/${ctx.exam.id}/print?user=${s.userId}`}
                target="_blank"
                rel="noopener"
                className="rounded-full bg-[color:var(--primary-fill)] px-3 py-1 text-xs font-bold text-white"
              >
                📄 הדפסת הסיכום
              </a>
              <a
                href={`/exams/summary/${ctx.exam.id}/tasks?user=${s.userId}`}
                target="_blank"
                rel="noopener"
                className="rounded-full border border-[color:var(--primary)]/50 px-3 py-1 text-xs font-bold text-[color:var(--primary)]"
              >
                📄 התשובות מהמשימות
              </a>
            </div>
            <div className="mt-3 space-y-3">
              {ctx.units.map((u) => {
                const v = s.units[u.key];
                return (
                  <div key={u.key} className="rounded-xl border border-[color:var(--border)] p-3">
                    <h3 className="font-display font-bold text-[color:var(--primary)]">
                      {u.title} <span className="text-xs font-normal">({u.chapters})</span>
                    </h3>
                    {v ? (
                      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                        {SUMMARY_FIELDS.filter((f) => v[f.key].trim() !== "").map((f) => (
                          <div key={f.key} className={f.key === "notes" ? "sm:col-span-2" : ""}>
                            <dt className="font-bold">{f.label}</dt>
                            <dd dir="auto" className="whitespace-pre-wrap text-start">
                              {v[f.key]}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-sm text-[color:var(--foreground)]/60">לא סוכם.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>
    </PageShell>
  );
}
