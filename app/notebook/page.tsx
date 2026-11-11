import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import NotebookApp from "@/components/notebook/notebook-app";
import { listEntries, listNotebookUnits, translateUnitLabels, unitsWithEntries } from "@/lib/notebook";
import { isStudentMode } from "@/lib/student-mode";
import { isEnglishStudent } from "@/lib/task-lang";

export const dynamic = "force-dynamic";

// "📓 המחברת שלי" (issue #52): the student's private notebook of lesson
// summaries. Only the student and the teachers can read it (teachers in the
// dashboard); it is never graded or checked.
export default async function NotebookPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (!user.guest && !user.onboarded) redirect("/onboarding");
  // a teacher reads notebooks from the roster; student mode is the exception
  if (user.role === "teacher" && !(await isStudentMode())) redirect("/dashboard/students");

  if (user.guest) {
    return (
      <PageShell title="📓 המחברת שלי">
        <p className="mx-auto max-w-md rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)] p-6 text-center text-sm leading-6">
          המחברת זמינה רק אחרי כניסה עם חשבון גוגל.
        </p>
      </PageShell>
    );
  }

  const userId = Number(user.id);
  let entries: Awaited<ReturnType<typeof listEntries>> = [];
  let units: Awaited<ReturnType<typeof listNotebookUnits>> = [];
  let failed = false;
  try {
    [entries, units] = await Promise.all([listEntries(userId), listNotebookUnits()]);
  } catch {
    failed = true;
  }
  const english = await isEnglishStudent(user);
  let allUnits = unitsWithEntries(units, entries);
  if (english) allUnits = await translateUnitLabels(allUnits);

  return (
    <PageShell title="📓 המחברת שלי" subtitle="סיכומים מהשיעורים, כל רשומה עם התאריך של היום שבו נכתבה. רק את והמורה רואות אותה.">
      {failed ? (
        <p className="mx-auto max-w-md text-center text-sm text-[color:var(--danger)]">לא הצלחנו לטעון את המחברת — נסו לרענן.</p>
      ) : (
        <div className="mx-auto max-w-3xl">
          <NotebookApp initialEntries={entries} initialUnits={allUnits} lang={english ? "en" : "he"} />
        </div>
      )}
    </PageShell>
  );
}
