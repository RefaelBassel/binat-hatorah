import Link from "next/link";
import { auth } from "@/auth";
import PageShell, { ComingSoon } from "@/components/page-shell";
import { getAttempt, publishedDocs, type DocRow } from "@/lib/exams";
import { formatHebDate, formatHebTime } from "@/lib/hebrew";

export const dynamic = "force-dynamic";

export default async function ExamsPage() {
  const session = await auth();
  const user = session?.user;
  let isTeacher = false;
  if (user?.role === "teacher" && !user.guest) {
    const { isStudentMode } = await import("@/lib/student-mode");
    isTeacher = !(await isStudentMode());
  }

  // students only ever see what the teacher published
  let docs: DocRow[] = [];
  try {
    docs = await publishedDocs();
  } catch {
    // DB unavailable
  }
  const preps = docs.filter((d) => d.kind === "prep");
  const exams = docs.filter((d) => d.kind === "exam");
  const status = new Map<number, string>();
  if (user?.id && !user.guest) {
    for (const e of exams) {
      try {
        const a = await getAttempt(e.id, Number(user.id));
        if (a?.approvedAt) status.set(e.id, `נבדק · ציון ${a.score}`);
        else if (a?.submittedAt) status.set(e.id, "הוגש · ממתין לבדיקה");
        else if (a) status.set(e.id, "בתהליך");
      } catch {}
    }
  }
  const t = Math.floor(Date.now() / 1000);

  return (
    <PageShell title="הכנות למבחנים" subtitle="דפי הכנה ומבחנים שהמורה פרסמה">
      {isTeacher && (
        <div className="mb-6 text-center">
          <Link
            href="/dashboard/exams"
            className="rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white shadow"
          >
            🗂 ניהול המבחנים ודפי ההכנה (מורה)
          </Link>
        </div>
      )}
      {docs.length === 0 ? (
        <ComingSoon note="דפי ההכנה והמבחנים יופיעו כאן כשהמורה תפרסם אותם." />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <section>
            <h2 className="mb-3 font-display text-xl font-bold text-[color:var(--primary)]">📄 דפי הכנה</h2>
            {preps.length === 0 && <p className="text-sm text-[color:var(--foreground)]/60">אין עדיין דפי הכנה.</p>}
            <ul className="space-y-3">
              {preps.map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/exams/prep/${p.id}`}
                    className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 font-bold shadow-sm transition hover:shadow-md"
                  >
                    {p.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="mb-3 font-display text-xl font-bold text-[color:var(--primary)]">📝 מבחנים</h2>
            {exams.length === 0 && <p className="text-sm text-[color:var(--foreground)]/60">אין עדיין מבחנים פתוחים.</p>}
            <ul className="space-y-3">
              {exams.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/exams/${e.id}`}
                    className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm transition hover:shadow-md"
                  >
                    <span className="font-bold">{e.title}</span>
                    <span className="mt-1 block text-sm text-[color:var(--foreground)]/70">
                      {e.opensAt && e.opensAt > t
                        ? `ייפתח ${formatHebDate(e.opensAt)}, ${formatHebTime(e.opensAt)}`
                        : "פתוח"}
                      {e.durationMin ? ` · ${e.durationMin} דקות` : ""}
                      {status.get(e.id) ? ` · ${status.get(e.id)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}
    </PageShell>
  );
}
