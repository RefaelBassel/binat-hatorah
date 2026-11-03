import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import EditorClient from "@/components/exams/editor-client";
import { requireTeacherPage } from "@/lib/exams-page";
import { attemptCount, getExam, linkedPreps } from "@/lib/exams";

export default async function ExamEditorPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const id = Number((await params).id);
  const exam = Number.isInteger(id) ? await getExam(id) : null;
  if (!exam) notFound();

  let related: { id: number; title: string; status: "draft" | "published" }[] = [];
  if (exam.kind === "exam") {
    related = (await linkedPreps(exam.id)).map((p) => ({ id: p.id, title: p.title, status: p.status }));
  } else if (exam.linkedExamId) {
    const parent = await getExam(exam.linkedExamId);
    if (parent) related = [{ id: parent.id, title: parent.title, status: parent.status }];
  }
  const attempts = exam.kind === "exam" ? await attemptCount(exam.id) : 0;

  return (
    <PageShell
      title={exam.kind === "prep" ? "עריכת דף הכנה" : "עריכת מבחן"}
      subtitle="השינויים נשמרים אוטומטית. התלמידים לא רואים כלום עד שמפרסמים."
    >
      <div className="mx-auto max-w-4xl">
        <EditorClient
          key={exam.id}
          examId={exam.id}
          kind={exam.kind}
          initialTitle={exam.title}
          initialDoc={exam.doc}
          initialStatus={exam.status}
          initialOpensAt={exam.opensAt}
          initialDuration={exam.durationMin}
          attemptCount={attempts}
          related={related}
        />
      </div>
    </PageShell>
  );
}
