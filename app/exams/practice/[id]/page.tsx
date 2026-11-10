import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/page-shell";
import { PrepView } from "@/components/exams/doc-view";
import MySummaries from "@/components/exams/my-summaries";
import DeckViewer from "@/components/exams/deck-viewer";
import { getPublicDeck } from "@/lib/student-decks";
import PracticeHub from "@/components/exams/practice-hub";
import { listDocs, prepBodyOf } from "@/lib/exams";
import { getSummaries, summaryContextForExam } from "@/lib/exam-summaries";
import type { SummaryValues } from "@/lib/exam-summary-types";
import {
  cardMarks,
  effectiveCards,
  effectiveOpenQuestions,
  getPracticeState,
  practiceUnits,
  quizPool,
  studentProgress,
} from "@/lib/practice";
import { getUserTaskView } from "@/lib/task-view";
import type { UnitProgress } from "@/lib/practice-types";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "prep", label: "דף ההכנה" },
  { key: "guide", label: "איך לומדים למבחן" },
  { key: "summaries", label: "הסיכומים שלי" },
  { key: "practice", label: "תרגול" },
  { key: "deck", label: "🖥️ מצגת חזרה" },
] as const;
type Tab = (typeof TABS)[number]["key"];

// "📚 תרגול למבחן" (issue #34): the exam's prep sheet, the study guide, the
// student's summaries and the practice area, as tabs of one page.
export default async function PracticePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === rawTab) ? (rawTab as Tab) : "practice";

  const state = await getPracticeState(Number(id));
  if (!state) notFound();
  const realTeacher = user.role === "teacher" && !user.guest;
  let teacherView = false;
  if (realTeacher) {
    const { isStudentMode } = await import("@/lib/student-mode");
    teacherView = !(await isStudentMode());
  }
  // closed practice: students never get in; teachers may preview
  if (state.openedAt == null && !realTeacher) notFound();

  const exam = state.exam;
  const docs = await listDocs();
  const prep = docs.find((d) => d.kind === "prep" && d.id === exam.prepId && d.publishedAt != null) ?? null;
  const guides = docs.filter((d) => d.kind === "prep" && d.linkedExamId === exam.id && d.publishedAt != null && d.id !== exam.prepId);
  const userId = Number(user.id);
  // the published student copy of the review presentation (no speaker notes)
  const deck = await getPublicDeck(exam.id).catch((e) => {
    console.error("student deck failed", e);
    return null;
  });
  // students see the tab only when there is something published; the teacher
  // always does (to preview, with a pointer to the editor)
  const tabs = TABS.filter((t) => t.key !== "deck" || deck != null || realTeacher);

  let content: React.ReactNode = null;
  if (tab === "deck") {
    content = deck ? (
      <DeckViewer slides={deck.slides} printHref={`/exams/practice/${exam.id}/deck-print`} />
    ) : (
      <Empty text="המצגת לא מפורסמת לתלמידות כרגע." />
    );
  } else if (tab === "prep") {
    content = prep ? (
      <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <PrepView title={prep.title} body={prepBodyOf(prep)} />
      </div>
    ) : (
      <Empty text="דף ההכנה עוד לא פורסם." />
    );
  } else if (tab === "guide") {
    content =
      guides.length > 0 ? (
        <div className="space-y-6">
          {guides.map((g) => (
            <div key={g.id} className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
              <PrepView title={g.title} body={prepBodyOf(g)} />
            </div>
          ))}
        </div>
      ) : (
        <Empty text="הדף ״איך לומדים למבחן״ עוד לא פורסם." />
      );
  } else if (tab === "summaries") {
    const ctx = await summaryContextForExam(exam.id).catch(() => null);
    if (!ctx) content = <Empty text="אזור הסיכומים ייפתח כשדף ההכנה יפורסם." />;
    else if (teacherView)
      content = (
        <p className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center text-sm">
          התלמידות רואות כאן את אזור ״הסיכומים שלי״.{" "}
          <Link href={`/dashboard/exams/${exam.id}/summaries`} className="font-semibold text-[color:var(--primary)] underline">
            צפייה בסיכומים שלהן
          </Link>
        </p>
      );
    else {
      let initial: Record<string, SummaryValues> = {};
      if (!user.guest) initial = await getSummaries(exam.id, userId).catch(() => ({}));
      content = (
        <MySummaries examId={exam.id} examTitle={exam.title} units={ctx.units} initial={initial} readOnly={Boolean(user.guest)} />
      );
    }
  } else {
    const units = practiceUnits(state.settings.units);
    const [cards, openQuestions, pool] = await Promise.all([
      effectiveCards(state),
      effectiveOpenQuestions(state),
      quizPool(state.settings.units),
    ]);
    const quizCounts: Record<string, number> = {};
    for (const p of pool) quizCounts[p.unitRef] = (quizCounts[p.unitRef] ?? 0) + 1;
    let marks: Record<string, boolean> = {};
    let progress: UnitProgress[] = units.map((u) => ({
      ref: u.ref,
      title: u.title,
      activity: 0,
      quizAnswered: 0,
      quizCorrect: 0,
      cardsTotal: cards.filter((c) => c.unitRef === u.ref).length,
      cardsKnown: 0,
    }));
    if (!user.guest) {
      [marks, progress] = await Promise.all([cardMarks(exam.id, userId), studentProgress(state, userId, cards)]);
    }
    content = (
      <PracticeHub
        examId={exam.id}
        units={units}
        quizCounts={quizCounts}
        cards={cards}
        cardMarks={marks}
        openQuestions={openQuestions}
        progress={progress}
        view={user.guest ? null : await getUserTaskView(userId)}
        durationMin={exam.durationMin ?? 90}
        readOnly={Boolean(user.guest)}
      />
    );
  }

  return (
    <PageShell title="📚 תרגול למבחן" subtitle={exam.title}>
      {realTeacher && (
        <div className="mx-auto mb-4 max-w-3xl rounded-2xl border border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10 p-3 text-center text-sm">
          {state.openedAt == null ? "תצוגה מקדימה: התרגול עדיין סגור לתלמידות. " : "התרגול פתוח לתלמידות. "}
          {teacherView && (
            <Link href={`/dashboard/exams/${exam.id}#practice`} className="font-semibold text-[color:var(--primary)] underline">
              הגדרות התרגול בעורך המבחן
            </Link>
          )}
        </div>
      )}
      <nav aria-label="לשוניות התרגול" className="mb-6 overflow-x-auto">
        <ul className="mx-auto flex w-max min-w-full justify-center gap-1 rounded-full border border-[color:var(--border)] bg-[color:var(--card)] p-1 shadow-sm">
          {tabs.map((t) => (
            <li key={t.key}>
              <Link
                href={`/exams/practice/${exam.id}?tab=${t.key}`}
                aria-current={t.key === tab ? "page" : undefined}
                className={`block whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition ${
                  t.key === tab
                    ? "bg-[color:var(--primary-fill)] text-white shadow"
                    : "text-[color:var(--primary)] hover:bg-[color:var(--border)]/40"
                }`}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "deck" && teacherView && (
        <p className="mx-auto mb-4 max-w-4xl text-center text-sm">
          <Link href={`/dashboard/exams/student-deck/${exam.id}`} className="font-semibold text-[color:var(--primary)] underline">
            עריכה ופרסום של המצגת לתלמידים
          </Link>
        </p>
      )}
      <div className="mx-auto max-w-4xl">{content}</div>
    </PageShell>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p className="mx-auto max-w-xl rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center text-sm text-[color:var(--foreground)]/70">
      {text}
    </p>
  );
}
