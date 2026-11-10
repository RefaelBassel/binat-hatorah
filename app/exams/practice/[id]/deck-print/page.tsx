import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import DeckPrintSheet from "@/components/exams/deck-print-sheet";
import { getPracticeState } from "@/lib/practice";
import { getPublicDeck } from "@/lib/student-decks";

export const dynamic = "force-dynamic";

// Print / PDF of the published student deck: only what students may see
// (no speaker notes), same access rule as the practice area.
export default async function StudentDeckPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const { id } = await params;
  const state = await getPracticeState(Number(id));
  if (!state) notFound();
  const realTeacher = user.role === "teacher" && !user.guest;
  if (state.openedAt == null && !realTeacher) notFound();
  const deck = await getPublicDeck(state.exam.id);
  if (!deck) notFound();
  return <DeckPrintSheet slides={deck.slides} />;
}
