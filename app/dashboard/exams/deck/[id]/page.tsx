import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import DeckEditor from "@/components/exams/deck-editor";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { fillSeedIfEmpty, getDeck } from "@/lib/decks";

export const dynamic = "force-dynamic";

export default async function DeckPage({ params }: { params: Promise<{ id: string }> }) {
  await requireTeacherPage();
  const { id } = await params;
  let deck;
  try {
    const found = await getDeck(Number(id));
    deck = found ? await fillSeedIfEmpty(found) : null;
  } catch (e) {
    console.error("deck load failed", e);
    return (
      <PageShell title="מצגת חזרה" subtitle="למורה בלבד: עריכה, הקרנה והדפסה">
        <p role="alert" className="text-center font-bold text-[color:var(--danger)]">
          לא הצלחנו לטעון את המצגת. רעננו את הדף ונסו שוב.
        </p>
      </PageShell>
    );
  }
  if (!deck) notFound();
  return (
    <PageShell title="מצגת חזרה" subtitle="למורה בלבד: עריכה, הקרנה והדפסה">
      <DeckEditor deckId={deck.id} initialTitle={deck.title} initialSlides={deck.slides} />
    </PageShell>
  );
}
