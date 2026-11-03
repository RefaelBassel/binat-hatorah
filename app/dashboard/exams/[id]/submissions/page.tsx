import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { requireTeacherPage } from "@/lib/exams-page";
import { getExam, listAttempts } from "@/lib/exams";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";

// Teacher only: who started / submitted the exam and where grading stands.
export default async function ExamSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const id = Number((await params).id);
  const exam = Number.isInteger(id) ? await getExam(id) : null;
  if (!exam || exam.kind !== "exam") notFound();
  const attempts = await listAttempts(exam.id);

  return (
    <PageShell title="הגשות המבחן" subtitle={exam.title}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={`/dashboard/exams/${exam.id}`}
          className="text-sm font-bold text-[color:var(--accent)] hover:underline"
        >
          ← חזרה לעריכת המבחן
        </Link>
        {attempts.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[color:var(--border)] p-8 text-center text-sm">
            עוד אף אחד לא התחיל את המבחן.
          </p>
        )}
        <ul className="space-y-2">
          {attempts.map((a) => {
            const state = a.approvedAt
              ? { label: `נבדק · ${a.score ?? 0}`, cls: "bg-[color:var(--status-graded-bg)] text-[color:var(--status-graded)]" }
              : a.submittedAt
                ? {
                    label: a.claudeScores ? "הוגש · יש הצעת ניקוד" : "הוגש · ממתין לבדיקה",
                    cls: "bg-[color:var(--status-submitted-bg)] text-[color:var(--status-submitted)]",
                  }
                : {
                    label: "בכתיבה",
                    cls: "bg-[color:var(--status-in-progress-bg)] text-[color:var(--status-in-progress)]",
                  };
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3"
              >
                <div>
                  <p className="font-bold text-[color:var(--primary)]">{a.studentName}</p>
                  <p className="text-xs text-[color:var(--foreground)]/60">
                    התחיל/ה {formatHebDate(a.startedAt)} {formatHebTime(a.startedAt)}
                    {a.submittedAt
                      ? ` · הוגש ${formatHebDate(a.submittedAt)} ${formatHebTime(a.submittedAt)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-xs font-bold ${state.cls}`}>{state.label}</span>
                  {a.submittedAt && (
                    <Link
                      href={`/dashboard/exams/${exam.id}/submissions/${a.id}`}
                      className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-sm font-bold text-white"
                    >
                      {a.approvedAt ? "צפייה" : "בדיקה"}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
