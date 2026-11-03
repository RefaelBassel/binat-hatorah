import Link from "next/link";
import PageShell from "@/components/page-shell";
import { requireTeacherPage } from "@/lib/exams-page";
import { attemptCount, ensureExamSeed, listExams, type ExamRow } from "@/lib/exams";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";
import { DuplicateButton, NewExamButton } from "@/components/exams/list-actions";

// Teacher-only list of exams and their prep sheets.
export default async function ExamsDashboardPage() {
  const { userId } = await requireTeacherPage();
  await ensureExamSeed(userId);
  const all = await listExams();
  const exams = all.filter((e) => e.kind === "exam");
  const preps = all.filter((e) => e.kind === "prep");
  const orphanPreps = preps.filter((p) => !exams.some((e) => e.id === p.linkedExamId));
  const counts = new Map<number, number>();
  for (const e of exams) counts.set(e.id, await attemptCount(e.id));

  return (
    <PageShell
      title="מבחנים"
      subtitle="מבחנים ודפי הכנה — עורכים, מדפיסים, ומפרסמים לתלמידים כשמוכנים. כל מה שלא פורסם נשאר טיוטה."
    >
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <NewExamButton />
          <Link href="/dashboard" className="text-sm font-bold text-[color:var(--accent)] hover:underline">
            ← לדשבורד
          </Link>
        </div>

        {all.length === 0 && (
          <p className="rounded-2xl border border-dashed border-[color:var(--border)] p-8 text-center text-sm">
            עוד אין מבחנים. לוחצים על ״מבחן חדש״ כדי להתחיל.
          </p>
        )}

        {exams.map((e) => (
          <div
            key={e.id}
            className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
          >
            <Row row={e} submissions={counts.get(e.id) ?? 0} />
            {preps
              .filter((p) => p.linkedExamId === e.id)
              .map((p) => (
                <div
                  key={p.id}
                  className="me-0 ms-6 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3"
                >
                  <Row row={p} />
                </div>
              ))}
          </div>
        ))}

        {orphanPreps.map((p) => (
          <div key={p.id} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
            <Row row={p} />
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function Row({ row, submissions }: { row: ExamRow; submissions?: number }) {
  const published = row.status === "published";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[color:var(--info-bg)] px-2.5 py-0.5 text-[11px] font-bold text-[color:var(--info)]">
            {row.kind === "prep" ? "דף הכנה" : "מבחן"}
          </span>
          <Link
            href={`/dashboard/exams/${row.id}`}
            className="font-display text-lg font-extrabold text-[color:var(--primary)] hover:underline"
          >
            {row.title}
          </Link>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              published
                ? "bg-[color:var(--success-fill)] text-white"
                : "bg-[color:var(--status-not-started-bg)] text-[color:var(--status-not-started)]"
            }`}
          >
            {published ? "פורסם לתלמידים" : "טיוטה"}
          </span>
        </div>
        <p className="mt-1 text-xs text-[color:var(--foreground)]/60">
          עודכן לאחרונה: {formatHebDate(row.updatedAt)} · {formatHebTime(row.updatedAt)}
          {row.kind === "exam" && row.durationMin ? ` · ${row.durationMin} דקות` : ""}
          {row.kind === "exam" && published && row.opensAt
            ? ` · נפתח ב-${formatHebDate(row.opensAt)} ${formatHebTime(row.opensAt)}`
            : ""}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/exams/${row.id}`}
          className="rounded-full bg-[color:var(--primary-fill)] px-4 py-2 text-sm font-bold text-white"
        >
          עריכה
        </Link>
        {submissions !== undefined && submissions > 0 && (
          <Link
            href={`/dashboard/exams/${row.id}/submissions`}
            className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm font-bold text-[color:var(--primary)] hover:border-[color:var(--accent)]"
          >
            הגשות ({submissions})
          </Link>
        )}
        <DuplicateButton id={row.id} />
      </div>
    </div>
  );
}
