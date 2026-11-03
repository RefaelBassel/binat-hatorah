import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { PrepSheet } from "@/components/exams/doc-view";
import { getPublished } from "@/lib/exams";
import type { PrepDoc } from "@/lib/exams-types";

// A published prep sheet as a reading page. Unpublished → 404 for everyone
// (the teacher edits and previews in /dashboard/exams).
export default async function PrepReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const prep = Number.isInteger(id) ? await getPublished(id, "prep") : null;
  if (!prep) notFound();
  return (
    <PageShell title="דף הכנה" subtitle="דף קריאה לקראת המבחן">
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/exams" className="text-sm font-bold text-[color:var(--accent)] hover:underline">
          ← חזרה להכנות למבחנים
        </Link>
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-6 py-6 sm:px-8">
          <PrepSheet doc={prep.doc as PrepDoc} title={prep.title} />
        </div>
      </div>
    </PageShell>
  );
}
