import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import DocEditor from "@/components/exams/doc-editor";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { attemptCounts, examBodyOf, getDoc, listDocs, prepBodyOf } from "@/lib/exams";
import PracticeEditor from "@/components/exams/practice-editor";
import PracticeStats from "@/components/exams/practice-stats";
import { allChapterUnits, classPractice, effectiveCards, effectiveOpenQuestions, getPracticeState } from "@/lib/practice";

export const dynamic = "force-dynamic";

export default async function ExamEditPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const { id } = await params;
  const doc = await getDoc(Number(id));
  if (!doc) notFound();
  const prep = doc.prepId != null ? await getDoc(doc.prepId) : null;
  const all = doc.kind === "prep" ? await listDocs() : [];
  const pairedExam = all.find((d) => d.kind === "exam" && d.prepId === doc.id);
  const linkedExam = pairedExam ?? all.find((d) => d.kind === "exam" && d.id === doc.linkedExamId);
  const counts = doc.kind === "exam" ? await attemptCounts() : null;

  return (
    <PageShell title={doc.kind === "exam" ? "עריכת מבחן" : "עריכת דף הכנה"}>
      <DocEditor
        doc={{
          id: doc.id,
          kind: doc.kind,
          title: doc.title,
          durationMin: doc.durationMin,
          body: doc.kind === "exam" ? examBodyOf(doc) : prepBodyOf(doc),
          publishedAt: doc.publishedAt,
          opensAt: doc.opensAt,
          prepId: prep?.id ?? null,
          prepTitle: prep?.title ?? null,
          linkedExamId: linkedExam?.id ?? null,
          guideExamId: pairedExam ? null : (linkedExam?.id ?? null),
          isGeneral: doc.kind === "prep" && !pairedExam,
          examOptions: all.filter((d) => d.kind === "exam").map((d) => ({ id: d.id, title: d.title || "מבחן ללא כותרת" })),
          attemptCount: counts?.get(doc.id)?.total ?? 0,
        }}
      />
      {doc.kind === "exam" && <PracticeSection examId={doc.id} />}
    </PageShell>
  );
}

// The students' practice area of this exam (issue #34): settings + who practiced.
async function PracticeSection({ examId }: { examId: number }) {
  const state = await getPracticeState(examId);
  if (!state) return null;
  const [cards, openQuestions, cls] = await Promise.all([
    effectiveCards(state),
    effectiveOpenQuestions(state),
    classPractice(state),
  ]);
  return (
    <>
      <PracticeEditor
        examId={examId}
        allUnits={allChapterUnits()}
        initialUnits={state.settings.units}
        initialCards={cards}
        cardsAuto={state.settings.cards == null}
        initialOpen={openQuestions}
        openAuto={state.settings.openQuestions == null}
        openedAt={state.openedAt}
      />
      <PracticeStats students={cls.students} missed={cls.missed} />
    </>
  );
}
