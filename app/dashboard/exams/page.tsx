import Link from "next/link";
import PageShell from "@/components/page-shell";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { attemptCounts, listDocs, type DocRow } from "@/lib/exams";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";
import { CreateButton, DuplicateButton } from "@/components/exams/list-actions";

export const dynamic = "force-dynamic";

export default async function ExamsDashboardPage() {
  await requireTeacherPage();
  let docs: DocRow[] = [];
  let counts = new Map<number, { total: number; submitted: number; approved: number }>();
  let failed = false;
  try {
    docs = await listDocs();
    counts = await attemptCounts();
  } catch (e) {
    console.error("exams list failed", e);
    failed = true;
  }
  const exams = docs.filter((d) => d.kind === "exam");
  const byId = new Map(docs.map((d) => [d.id, d]));
  const linkedPreps = new Set(exams.map((e) => e.prepId).filter((x): x is number => x != null));
  const loosePreps = docs.filter((d) => d.kind === "prep" && !linkedPreps.has(d.id));

  return (
    <PageShell title="מבחנים" subtitle="מבחנים ודפי הכנה: עריכה, הדפסה, פרסום לתלמידים ובדיקת הגשות">
      <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
        <CreateButton kind="exam" label="+ מבחן חדש" primary />
        <CreateButton kind="prep" label="+ דף הכנה חדש" />
        <Link href="/dashboard" className="text-sm font-semibold text-[color:var(--primary)] underline">
          חזרה לדשבורד
        </Link>
      </div>
      {failed && <p className="text-center text-[color:var(--danger)]">לא ניתן לטעון כרגע. נסו לרענן.</p>}
      <div className="space-y-4">
        {exams.map((e) => {
          const prep = e.prepId != null ? byId.get(e.prepId) : undefined;
          const c = counts.get(e.id);
          return (
            <div key={e.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
              <DocLine doc={e} icon="📝" />
              {c && c.total > 0 && (
                <p className="mt-1 text-sm">
                  <Link href={`/dashboard/exams/${e.id}/submissions`} className="font-semibold text-[color:var(--primary)] underline">
                    הגשות: {c.submitted} הוגשו · {c.approved} נבדקו
                  </Link>
                </p>
              )}
              <div className="mt-3 border-t border-[color:var(--border)]/60 ps-6 pt-3">
                {prep ? (
                  <DocLine doc={prep} icon="📄" small />
                ) : (
                  <p className="text-sm text-[color:var(--foreground)]/60">אין דף הכנה מקושר (אפשר ליצור מתוך עריכת המבחן).</p>
                )}
              </div>
            </div>
          );
        })}
        {loosePreps.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
            <DocLine doc={p} icon="📄" />
          </div>
        ))}
        {!failed && docs.length === 0 && <p className="text-center">אין עדיין מבחנים.</p>}
      </div>
    </PageShell>
  );
}

function DocLine({ doc, icon, small }: { doc: DocRow; icon: string; small?: boolean }) {
  const published = doc.publishedAt != null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Link
          href={`/dashboard/exams/${doc.id}`}
          className={`font-display font-bold text-[color:var(--primary)] hover:underline ${small ? "text-base" : "text-lg"}`}
        >
          {icon} {doc.title || (doc.kind === "exam" ? "מבחן ללא כותרת" : "דף הכנה ללא כותרת")}
        </Link>
        <p className="text-xs text-[color:var(--foreground)]/60">
          {doc.kind === "exam" ? "מבחן" : "דף הכנה"} · עודכן לאחרונה {formatHebDate(doc.updatedAt)}, {formatHebTime(doc.updatedAt)}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            published
              ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
              : "bg-[color:var(--foreground)]/10 text-[color:var(--foreground)]/70"
          }`}
        >
          {published ? "פורסם לתלמידים" : "טיוטה"}
        </span>
        <Link
          href={`/dashboard/exams/${doc.id}`}
          className="rounded-full bg-[color:var(--primary-fill)] px-3 py-1 text-xs font-bold text-white"
        >
          עריכה
        </Link>
        <DuplicateButton id={doc.id} />
      </div>
    </div>
  );
}
