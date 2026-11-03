import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PrintNow } from "@/components/exams/list-actions";
import { MARK_META } from "@/lib/completion-meta";
import { studentName, summaryContextForExam, summaryUnitsOfExam, taskBooklet } from "@/lib/exam-summaries";

export const dynamic = "force-dynamic";

// Review booklet: the student's OWN answers in the tasks of the units the
// exam covers, in unit order — the question and her answer beneath it, and
// the teacher's approved feedback (✓/✗ and notes) when there is some.
// Clean print page, right-to-left, no site chrome.
export default async function TasksBookletPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ user?: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) redirect("/login");
  const { id } = await params;
  const { user: userParam } = await searchParams;
  const isTeacher = user.role === "teacher";
  const targetId = isTeacher && userParam ? Number(userParam) : Number(user.id);
  if (!Number.isInteger(targetId)) notFound();
  const ctx = isTeacher ? await summaryUnitsOfExam(Number(id)) : await summaryContextForExam(Number(id));
  if (!ctx) notFound();

  const [booklet, name] = await Promise.all([taskBooklet(targetId, ctx.units), studentName(targetId)]);
  const printed = new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date());
  const total = booklet.reduce((s, b) => s + b.questions.length, 0);

  return (
    <main className="mx-auto w-full max-w-3xl bg-white px-6 py-6 text-black print:max-w-none print:px-0 print:py-0">
      <style>{`@page { size: A4; margin: 15mm; }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--foreground)]">
        <span className="text-sm">חוברת חזרה מוכנה להדפסה · בחלון ההדפסה אפשר לבחור ״שמירה כ־PDF״</span>
        <PrintNow />
      </div>
      <header className="mb-5 border-b-2 border-black pb-3">
        <h1 className="font-display text-2xl font-extrabold">התשובות שלי מהמשימות: {ctx.exam.title}</h1>
        <p className="mt-1 text-base">
          שם: <strong dir="auto">{name}</strong> · תאריך הדפסה: {printed}
        </p>
      </header>
      {total === 0 && <p className="text-base">עוד אין תשובות שנכתבו במשימות של היחידות האלה.</p>}
      {booklet.map(({ unit, questions, hasTask }) => (
        <section key={unit.key} className="mb-8">
          <h2 className="break-after-avoid border-b border-black pb-1 font-display text-xl font-bold">
            {unit.title} <span className="text-sm font-normal">({unit.chapters})</span>
          </h2>
          {questions.length === 0 && (
            <p className="mt-2 text-sm text-neutral-600">
              {hasTask ? "עוד לא נכתבו תשובות במשימה של היחידה." : "המשימה של היחידה עוד לא הוקצתה."}
            </p>
          )}
          <ol className="mt-3 space-y-4">
            {questions.map((q, i) => (
              <li key={`${unit.key}-${i}`} className="break-inside-avoid">
                <p className="text-sm font-bold text-neutral-700">{q.label}</p>
                <p dir="auto" className="whitespace-pre-wrap text-[15px] font-semibold leading-7">
                  {q.prompt}
                </p>
                <p
                  dir="auto"
                  className="mt-1 whitespace-pre-wrap border-s-4 border-neutral-400 ps-3 text-[15px] leading-7"
                >
                  {q.answer}
                </p>
                {q.mark && (
                  <p className="mt-1 text-sm">
                    <strong>
                      {MARK_META[q.mark.mark].symbol} {MARK_META[q.mark.mark].label}
                    </strong>
                    {q.mark.note && <span dir="auto"> · {q.mark.note}</span>}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </main>
  );
}
