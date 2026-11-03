import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { attemptsForExam, getDoc, now } from "@/lib/exams";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";

export const dynamic = "force-dynamic";

export default async function ExamSubmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const { id } = await params;
  const exam = await getDoc(Number(id));
  if (!exam || exam.kind !== "exam") notFound();
  const attempts = await attemptsForExam(exam.id);
  const t = now();

  return (
    <PageShell title={`הגשות: ${exam.title}`} subtitle="הבדיקה האוטומטית מציעה ניקוד לפי המחוון, והמורה מאשרת את הציון">
      <p className="mb-4 text-center">
        <Link href={`/dashboard/exams/${exam.id}`} className="text-sm font-semibold text-[color:var(--primary)] underline">
          ← חזרה לעריכת המבחן
        </Link>
      </p>
      {attempts.length === 0 ? (
        <p className="text-center">אין עדיין הגשות.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[color:var(--primary)]/10 text-right">
              <tr>
                <th className="p-3">תלמיד/ה</th>
                <th className="p-3">מצב</th>
                <th className="p-3">הצעת ניקוד</th>
                <th className="p-3">ציון</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => {
                const state = a.approvedAt
                  ? { label: "נבדק ואושר", cls: "text-[color:var(--success)]" }
                  : a.submittedAt
                    ? { label: `הוגש ${formatHebDate(a.submittedAt)}, ${formatHebTime(a.submittedAt)}`, cls: "text-[color:var(--warning)]" }
                    : a.deadlineAt < t
                      ? { label: "הזמן נגמר, לא הוגש", cls: "text-[color:var(--danger)]" }
                      : { label: "בעבודה עכשיו", cls: "text-[color:var(--primary)]" };
                return (
                  <tr key={a.userId} className="border-t border-[color:var(--border)]/60">
                    <td className="p-3 font-semibold">{a.name}</td>
                    <td className={`p-3 font-semibold ${state.cls}`}>{state.label}</td>
                    <td className="p-3">
                      {a.claudePoints ? "מוכנה" : a.claudeError ? <span className="text-[color:var(--danger)]">נכשלה</span> : a.submittedAt ? "בהכנה…" : "—"}
                    </td>
                    <td className="p-3 font-bold">{a.approvedAt ? a.score : "—"}</td>
                    <td className="p-3">
                      <Link
                        href={`/dashboard/exams/${exam.id}/submissions/${a.userId}`}
                        className="rounded-full bg-[color:var(--primary-fill)] px-3 py-1 text-xs font-bold text-white"
                      >
                        {a.approvedAt ? "צפייה" : "בדיקה"}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
