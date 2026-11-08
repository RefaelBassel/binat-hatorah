import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import DeckEditor from "@/components/exams/deck-editor";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { getDeck } from "@/lib/decks";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const { id } = await params;
  const deck = await getDeck(Number(id));
  if (!deck) notFound();
  return (
    <PageShell title="מצגת חזרה" subtitle="למורה בלבד: עריכה, הקרנה והדפסה">
      <DeckEditor deckId={deck.id} initialTitle={deck.title} initialSlides={deck.slides} />
    </PageShell>
  );
}
