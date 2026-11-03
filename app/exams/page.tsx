import Link from "next/link";
import { auth } from "@/auth";
import PageShell, { ComingSoon } from "@/components/page-shell";
import { getAttempt, listPublishedForStudents, nowSec, type StudentExamItem } from "@/lib/exams";
import { formatFullDate, formatHebTime } from "@/lib/hebrew";

// Students see only what the teacher PUBLISHED: prep sheets as reading pages
// and exams (when they open). Unpublished drafts do not exist for them.
export default async function ExamsPage() {
  const session = await auth();
  const user = session?.user;
  const isTeacher = user?.role === "teacher" && !user.guest;
  let teacherMode = false;
  if (isTeacher) {
    const { isStudentMode } = await import("@/lib/student-mode");
    teacherMode = !(await isStudentMode());
  }

  let items: StudentExamItem[] = [];
  const attempts = new Map<number, Awaited<ReturnType<typeof getAttempt>>>();
  try {
    items = await listPublishedForStudents();
    if (user?.id && !user.guest) {
      for (const it of items) {
        if (it.kind === "exam") attempts.set(it.id, await getAttempt(it.id, Number(user.id)));
      }
    }
  } catch {
    items = [];
  }
  const preps = items.filter((i) => i.kind === "prep");
  const exams = items.filter((i) => i.kind === "exam");
  const t = nowSec();

  return (
    <PageShell
      title="הכנות למבחנים"
      subtitle="דפי הכנה ומבחנים שהמורה פרסמה"
    >
      {teacherMode && (
        <p className="mb-6 text-center">
          <Link
            href="/dashboard/exams"
            className="rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white"
          >
            לניהול ועריכה של המבחנים
          </Link>
        </p>
      )}
      {items.length === 0 ? (
        <ComingSoon note="המבחנים ודפי ההכנה יעלו לכאן על ידי המורה לקראת כל מבחן." />
      ) : (
        <div className="mx-auto max-w-3xl space-y-8">
          {exams.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-extrabold text-[color:var(--primary)]">מבחנים</h2>
              {exams.map((e) => {
                const a = attempts.get(e.id) ?? null;
                const open = e.opensAt !== null && t >= e.opensAt;
                let status: React.ReactNode;
                if (a?.approvedAt) {
                  status = <>הציון: <b>{a.score}</b></>;
                } else if (a?.submittedAt) {
                  status = "הוגש — ממתין לבדיקת המורה";
                } else if (a) {
                  status = "התחלת — אפשר להמשיך";
                } else if (open) {
                  status = "פתוח לכניסה";
                } else if (e.opensAt) {
                  status = `ייפתח ב${formatFullDate(e.opensAt)} בשעה ${formatHebTime(e.opensAt)}`;
                } else {
                  status = "";
                }
                const canEnter = Boolean(a) || open;
                return (
                  <div
                    key={e.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
                  >
                    <div>
                      <p className="font-display text-lg font-extrabold text-[color:var(--primary)]">{e.title}</p>
                      <p className="text-sm text-[color:var(--foreground)]/70">
                        {e.durationMin ? `${e.durationMin} דקות · ` : ""}
                        {status}
                      </p>
                    </div>
                    {canEnter && !isTeacher && !user?.guest && (
                      <Link
                        href={`/exams/take/${e.id}`}
                        className="rounded-full bg-[color:var(--primary-fill)] px-5 py-2 text-sm font-bold text-white"
                      >
                        {a?.submittedAt ? "לצפייה" : a ? "להמשך המבחן" : "לכניסה למבחן"}
                      </Link>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {preps.length > 0 && (
            <section className="space-y-3">
              <h2 className="font-display text-xl font-extrabold text-[color:var(--primary)]">דפי הכנה</h2>
              {preps.map((p) => (
                <Link
                  key={p.id}
                  href={`/exams/prep/${p.id}`}
                  className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 font-display text-lg font-extrabold text-[color:var(--primary)] hover:border-[color:var(--accent)]"
                >
                  {p.title}
                </Link>
              ))}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
