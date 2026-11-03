import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTeacherPage } from "@/lib/exams-page";
import { getExam } from "@/lib/exams";
import type { ExamDoc, PrepDoc } from "@/lib/exams-types";
import { ExamSheet, PrepSheet } from "@/components/exams/doc-view";
import PrintButton from "@/components/exams/print-button";

// Clean print layout (teacher only). Modes:
//   exam   — the exam without the rubric, with a name/date line
//   rubric — the exam with the teacher's rubric under every question
//   prep   — the prep sheet
// The page chrome (toolbar, site nav, footer) is hidden when printing; the
// sheet itself is forced to black on white even in dark mode.
export default async function PrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireTeacherPage();
  const id = Number((await params).id);
  const exam = Number.isInteger(id) ? await getExam(id) : null;
  if (!exam) notFound();
  const mode = (await searchParams).mode;

  const isPrep = exam.kind === "prep";
  const rubric = !isPrep && mode === "rubric";

  return (
    <div className="exam-print-root min-h-screen bg-[color:var(--background)]">
      <style>{`
        @page { size: A4; margin: 16mm 14mm; }
        @media print {
          .exam-print-root { background: #fff !important; min-height: 0 !important; }
          .exam-sheet { box-shadow: none !important; border: 0 !important; padding: 0 !important; max-width: none !important; }
        }
        .exam-sheet, .exam-sheet * { --foreground: #111; --warning: #7a5a10; }
        .exam-sheet { background: #fff; color: #111; }
      `}</style>
      <div className="no-print mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <Link
          href={`/dashboard/exams/${exam.id}`}
          className="text-sm font-bold text-[color:var(--accent)] hover:underline"
        >
          ← חזרה לעריכה
        </Link>
        <span className="text-sm font-semibold text-[color:var(--foreground)]/70">
          {isPrep ? "דף ההכנה להדפסה" : rubric ? "המחוון להדפסה — לא להפצה לתלמידים" : "המבחן להדפסה, בלי המחוון"}
        </span>
        <PrintButton label={rubric ? "הדפסת המחוון" : isPrep ? "הדפסת דף ההכנה" : "הדפסה / PDF"} />
      </div>
      <main className="exam-sheet mx-auto max-w-3xl rounded-xl border border-[color:var(--border)] px-8 py-8 shadow-sm">
        {isPrep ? (
          <PrepSheet doc={exam.doc as PrepDoc} title={exam.title} />
        ) : (
          <ExamSheet
            doc={exam.doc as ExamDoc}
            title={rubric ? `${exam.title} — מחוון` : exam.title}
            showRubric={rubric}
            withNameLine={!rubric}
          />
        )}
      </main>
    </div>
  );
}
