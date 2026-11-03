import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/page-shell";
import { PrepView } from "@/components/exams/doc-view";
import MySummaries from "@/components/exams/my-summaries";
import { getDoc, prepBodyOf } from "@/lib/exams";
import { getSummaries, summaryContextForPrep } from "@/lib/exam-summaries";
import type { SummaryValues } from "@/lib/exam-summary-types";

export const dynamic = "force-dynamic";

// A published prep sheet as a reading page, with the student's own summaries
// ("הסיכומים שלי", issue #28) when the exam it belongs to covers units.
export default async function PrepReadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const doc = await getDoc(Number(id));
  if (!doc || doc.kind !== "prep" || doc.publishedAt == null) notFound();

  const user = session.user;
  let teacherView = false;
  if (user.role === "teacher" && !user.guest) {
    const { isStudentMode } = await import("@/lib/student-mode");
    teacherView = !(await isStudentMode());
  }
  let summaries: Awaited<ReturnType<typeof summaryContextForPrep>> = null;
  let initial: Record<string, SummaryValues> = {};
  try {
    summaries = await summaryContextForPrep(doc);
    if (summaries && user.id && !user.guest && !teacherView) {
      initial = await getSummaries(summaries.exam.id, Number(user.id));
    }
  } catch (e) {
    console.error("summaries failed", e);
  }
  return (
    <PageShell title="דף הכנה">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <PrepView title={doc.title} body={prepBodyOf(doc)} />
      </div>
      {summaries && !teacherView && (
        <MySummaries
          examId={summaries.exam.id}
          examTitle={summaries.exam.title}
          units={summaries.units}
          initial={initial}
          readOnly={Boolean(user.guest)}
        />
      )}
      {summaries && teacherView && (
        <p className="mx-auto mt-6 max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center text-sm">
          התלמידות רואות כאן את אזור ״הסיכומים שלי״.{" "}
          <Link href={`/dashboard/exams/${summaries.exam.id}/summaries`} className="font-semibold text-[color:var(--primary)] underline">
            צפייה בסיכומים שלהן
          </Link>
        </p>
      )}
      <p className="mt-6 text-center">
        <Link href="/exams" className="font-semibold text-[color:var(--primary)] underline">
          חזרה להכנות למבחנים
        </Link>
      </p>
    </PageShell>
  );
}
