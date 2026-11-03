import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PrintNow } from "@/components/exams/list-actions";
import { getSummaries, studentName, summaryContextForExam, summaryUnitsOfExam } from "@/lib/exam-summaries";
import { SUMMARY_FIELDS } from "@/lib/exam-summary-types";

export const dynamic = "force-dynamic";

// Clean print page of a student's summary table: right-to-left, no site
// chrome, nikud kept. The student prints her own; a teacher may open any
// student's with ?user=<id> (from the dashboard).
export default async function SummaryPrintPage({
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

  const [summaries, name] = await Promise.all([getSummaries(ctx.exam.id, targetId), studentName(targetId)]);
  const printed = new Intl.DateTimeFormat("he-IL", { dateStyle: "long" }).format(new Date());

  return (
    <main className="summary-print mx-auto w-full max-w-5xl bg-white px-6 py-6 text-black print:max-w-none print:px-0 print:py-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--foreground)]">
        <span className="text-sm">הסיכום מוכן להדפסה · בחלון ההדפסה אפשר לבחור ״שמירה כ־PDF״</span>
        <PrintNow />
      </div>
      <header className="mb-4 border-b-2 border-black pb-3">
        <h1 className="font-display text-2xl font-extrabold">הסיכומים שלי: {ctx.exam.title}</h1>
        <p className="mt-1 text-base">
          שם: <strong dir="auto">{name}</strong> · תאריך הדפסה: {printed}
        </p>
      </header>
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[44rem] border-collapse text-[13px] leading-6 print:min-w-0">
          <thead>
            <tr className="bg-neutral-200 text-right">
              <th className="border border-black p-2">יחידה</th>
              {SUMMARY_FIELDS.map((f) => (
                <th key={f.key} className="border border-black p-2">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ctx.units.map((u) => {
              const v = summaries[u.key];
              return (
                <tr key={u.key} className="break-inside-avoid align-top">
                  <th className="border border-black p-2 text-right">
                    {u.title}
                    <span className="block text-xs font-normal">({u.chapters})</span>
                  </th>
                  {SUMMARY_FIELDS.map((f) => (
                    <td key={f.key} dir="auto" className="whitespace-pre-wrap border border-black p-2 text-start">
                      {v?.[f.key]?.trim() ? v[f.key] : <span className="text-neutral-400">&nbsp;</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
