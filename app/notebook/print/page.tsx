import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PrintNow } from "@/components/exams/list-actions";
import { entriesForPrint, listNotebookUnits, notebookOwnerName } from "@/lib/notebook";
import { formatEntryDate, isDateStr, sanitizeNotebookHtml, shortDate } from "@/lib/notebook-shared";
import { isEnglishStudent } from "@/lib/task-lang";

export const dynamic = "force-dynamic";

// Clean print page of a notebook: right-to-left, no site chrome, nikud kept,
// the student's name on top. The student prints her own; a teacher may open
// any student's with ?user=<id> (from the dashboard). Filters: from / to
// (YYYY-MM-DD, Israel dates) and unit.
export default async function NotebookPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; unit?: string; user?: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) redirect("/login");
  const sp = await searchParams;
  const isTeacher = user.role === "teacher";
  const targetId = isTeacher && sp.user ? Number(sp.user) : Number(user.id);
  if (!Number.isInteger(targetId)) redirect("/notebook");

  const from = isDateStr(sp.from) ? sp.from : undefined;
  const to = isDateStr(sp.to) ? sp.to : undefined;
  const unit = typeof sp.unit === "string" && sp.unit ? sp.unit : undefined;

  const [entries, name, units] = await Promise.all([
    entriesForPrint(targetId, { from, to, unit }),
    notebookOwnerName(targetId),
    listNotebookUnits(),
  ]);
  const english = !isTeacher && (await isEnglishStudent(user));
  const lang = english ? "en" : "he";
  const unitLabel = (key: string) => units.find((u) => u.key === key)?.label ?? "";
  const printed = new Intl.DateTimeFormat("he-IL", { dateStyle: "long", timeZone: "Asia/Jerusalem" }).format(new Date());

  const scope: string[] = [];
  if (from || to) {
    scope.push(`${from ? shortDate(from) : "…"} – ${to ? shortDate(to) : "…"}`);
  }
  if (unit) scope.push(`יחידה: ${unitLabel(unit) || unit}`);

  return (
    <main
      dir="rtl"
      className="mx-auto w-full max-w-3xl bg-white px-6 py-6 text-black print:max-w-none print:px-0 print:py-0"
    >
      <style>{`@page { size: A4; margin: 15mm; }`}</style>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--foreground)]">
        <span className="text-sm">המחברת מוכנה להדפסה · בחלון ההדפסה אפשר לבחור ״שמירה כ־PDF״</span>
        <PrintNow />
      </div>
      <header className="mb-6 border-b-2 border-black pb-3">
        <h1 className="font-display text-2xl font-extrabold">המחברת של {name}</h1>
        <p className="mt-1 text-sm">
          {scope.length > 0 ? `${scope.join(" · ")} · ` : "כל המחברת · "}
          תאריך הדפסה: {printed}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="py-10 text-center text-base">אין רשומות להדפסה בטווח שנבחר.</p>
      ) : (
        entries.map((e) => (
          <article key={e.id} className="mb-7">
            <h2 className="break-after-avoid border-b border-neutral-400 pb-1 text-lg font-extrabold">
              {formatEntryDate(e.entryDate, lang)}
              {e.title && <span> · {e.title}</span>}
            </h2>
            {e.unitKey && unitLabel(e.unitKey) && (
              <p className="mt-1 text-xs font-semibold text-neutral-600">יחידה: {unitLabel(e.unitKey)}</p>
            )}
            <div
              className="notebook-body mt-2 text-[15px] leading-7"
              dangerouslySetInnerHTML={{ __html: sanitizeNotebookHtml(e.body) }}
            />
          </article>
        ))
      )}
    </main>
  );
}
