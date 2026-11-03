import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import GradesReportTable from "@/components/dashboard/grades-report";
import { buildGradesReport, type GradesReport } from "@/lib/grades-report";

// The teacher's grades report (#24): completion status per student per
// published task, with row and column summaries, filters and a CSV export.
export default async function GradesReportPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  let report: GradesReport | null = null;
  try {
    report = await buildGradesReport();
  } catch {
    // DB unavailable
  }

  return (
    <PageShell
      title="דוח ציונים"
      subtitle="סטטוס הביצוע של כל תלמיד/ה בכל משימה שפורסמה — לחיצה על תא פותחת את ההגשה"
    >
      <p className="mb-6 text-center">
        <Link
          href="/dashboard"
          className="text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          → חזרה לדשבורד
        </Link>
      </p>
      {report == null ? (
        <p className="text-center text-sm text-[color:var(--danger)]">
          לא הצלחנו לטעון את הדוח כרגע — נסו לרענן.
        </p>
      ) : report.tasks.length === 0 || report.students.length === 0 ? (
        <p className="text-center text-sm text-[color:var(--foreground)]/60">
          {report.tasks.length === 0 ? "עדיין לא פורסמו משימות." : "עדיין אין תלמידים בכיתה."}
        </p>
      ) : (
        <GradesReportTable report={report} />
      )}
    </PageShell>
  );
}
