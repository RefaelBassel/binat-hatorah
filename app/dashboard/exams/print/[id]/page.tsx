import { notFound } from "next/navigation";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { examBodyOf, getDoc, prepBodyOf } from "@/lib/exams";
import { ExamView, PrepView } from "@/components/exams/doc-view";
import { PrintNow } from "@/components/exams/list-actions";

export const dynamic = "force-dynamic";

// Clean print page (no site chrome). ?mode=rubric prints the marking guide;
// the default exam print never includes it.
export default async function ExamPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  await requireTeacherPage();
  const { id } = await params;
  const { mode } = await searchParams;
  const doc = await getDoc(Number(id));
  if (!doc) notFound();
  const rubric = doc.kind === "exam" && mode === "rubric";
  return (
    <main className="mx-auto w-full max-w-3xl bg-white px-8 py-8 text-black print:max-w-none print:px-0 print:py-0">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--foreground)]">
        <span className="text-sm">
          {doc.kind === "prep" ? "דף הכנה" : rubric ? "מחוון (למורה בלבד)" : "מבחן נקי להדפסה, בלי המחוון"} · בחלון ההדפסה אפשר לבחור ״שמירה כ־PDF״
        </span>
        <PrintNow />
      </div>
      {doc.kind === "exam" ? (
        <>
          {!rubric && (
            <div className="mb-6 flex justify-between gap-6 text-sm">
              <span>שם: ______________________</span>
              <span>כיתה: ________</span>
              <span>תאריך: ____________</span>
            </div>
          )}
          <ExamView title={doc.title} durationMin={doc.durationMin} body={examBodyOf(doc)} showRubric={rubric} />
          <p className="mt-10 text-center text-sm font-semibold">בהצלחה!</p>
        </>
      ) : (
        <PrepView title={doc.title} body={prepBodyOf(doc)} />
      )}
    </main>
  );
}
