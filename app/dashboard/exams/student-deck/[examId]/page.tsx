import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import DeckEditor from "@/components/exams/deck-editor";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { ensureStudentDeck } from "@/lib/student-decks";

export const dynamic = "force-dynamic";

// The student copy of an exam's review presentation (issue #53): created on
// first open (exactly once), edited separately from the teacher's own deck.
export default async function StudentDeckPage({ params }: { params: Promise<{ examId: string }> }) {
  await requireTeacherPage();
  const { examId } = await params;
  let deck;
  try {
    deck = await ensureStudentDeck(Number(examId));
  } catch (e) {
    console.error("student deck load failed", e);
    return (
      <PageShell title="מצגת חזרה — לתלמידים" subtitle="למורה בלבד: עריכה, פרסום והדפסה">
        <p role="alert" className="text-center font-bold text-[color:var(--danger)]">
          לא הצלחנו לטעון את המצגת. רעננו את הדף ונסו שוב.
        </p>
      </PageShell>
    );
  }
  if (!deck) notFound();
  return (
    <PageShell title="מצגת חזרה — לתלמידים" subtitle="עותק נפרד מהמצגת שלך. הערות הדובר לא מוצגות לתלמידים">
      <DeckEditor
        deckId={deck.id}
        initialTitle={deck.title}
        initialSlides={deck.slides}
        studentCopy={{ examId: deck.examId, published: deck.published }}
      />
    </PageShell>
  );
}
