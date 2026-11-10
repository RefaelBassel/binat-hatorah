import { notFound } from "next/navigation";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { ensureStudentDeck, publicSlides } from "@/lib/student-decks";
import DeckPrintSheet from "@/components/exams/deck-print-sheet";

export const dynamic = "force-dynamic";

// Print / PDF of the student copy (teacher): one slide per page, no notes.
export default async function StudentDeckTeacherPrintPage({ params }: { params: Promise<{ examId: string }> }) {
  await requireTeacherPage();
  const { examId } = await params;
  const deck = await ensureStudentDeck(Number(examId));
  if (!deck) notFound();
  return <DeckPrintSheet slides={publicSlides(deck.slides)} />;
}
