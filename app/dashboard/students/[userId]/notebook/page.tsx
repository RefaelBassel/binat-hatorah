import Link from "next/link";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import NotebookApp from "@/components/notebook/notebook-app";
import { listEntries, listNotebookUnits, notebookOwnerName, unitsWithEntries } from "@/lib/notebook";

export const dynamic = "force-dynamic";

// A student's notebook as the teacher sees it: view only, no grade, no check.
export default async function StudentNotebookPage({ params }: { params: Promise<{ userId: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher" || user.guest) redirect("/");

  const studentId = Number((await params).userId);
  if (!Number.isInteger(studentId)) notFound();
  const name = await notebookOwnerName(studentId);
  if (!name) notFound();

  const [entries, units] = await Promise.all([listEntries(studentId), listNotebookUnits()]);

  return (
    <PageShell title={`📓 המחברת של ${name}`} subtitle="צפייה בלבד. אין ציון ואין בדיקה למחברת.">
      <div className="mx-auto max-w-3xl">
        <Link href="/dashboard/students" className="mb-4 inline-block text-sm font-semibold text-[color:var(--primary)] underline-offset-2 hover:underline">
          → חזרה לרשימת התלמידים
        </Link>
        <NotebookApp initialEntries={entries} initialUnits={unitsWithEntries(units, entries)} readOnly ownerId={studentId} />
      </div>
    </PageShell>
  );
}
