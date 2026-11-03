import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/page-shell";
import { PrepView } from "@/components/exams/doc-view";
import { getDoc, prepBodyOf } from "@/lib/exams";

export const dynamic = "force-dynamic";

// A published prep sheet as a reading page.
export default async function PrepReadPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const doc = await getDoc(Number(id));
  if (!doc || doc.kind !== "prep" || doc.publishedAt == null) notFound();
  return (
    <PageShell title="דף הכנה">
      <div className="mx-auto max-w-3xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm sm:p-8">
        <PrepView title={doc.title} body={prepBodyOf(doc)} />
      </div>
      <p className="mt-6 text-center">
        <Link href="/exams" className="font-semibold text-[color:var(--primary)] underline">
          חזרה להכנות למבחנים
        </Link>
      </p>
    </PageShell>
  );
}
