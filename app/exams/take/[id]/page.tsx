import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/page-shell";
import ExamTaker from "@/components/exams/exam-taker";
import StartExamButton from "@/components/exams/start-exam-button";
import { getAttempt, getPublished, nowSec } from "@/lib/exams";
import type { ExamDoc } from "@/lib/exams-types";
import { formatFullDate, formatHebTime } from "@/lib/hebrew";

// A student takes a PUBLISHED exam here. An unpublished exam is a 404 — the
// student cannot even tell it exists. The document comes from the frozen
// student copy, which has no rubric.
export default async function TakeExamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role === "teacher" && !user.guest) {
    const id = Number((await params).id);
    redirect(`/dashboard/exams/${id}`);
  }
  const id = Number((await params).id);
  const exam = Number.isInteger(id) ? await getPublished(id, "exam") : null;
  if (!exam) notFound();
  if (user.guest) {
    return (
      <PageShell title={exam.title} subtitle="מבחן">
        <p className="mx-auto max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm">
          כדי לענות על המבחן צריך להתחבר עם החשבון האישי.
        </p>
      </PageShell>
    );
  }

  const userId = Number(user.id);
  const t = nowSec();
  const attempt = await getAttempt(exam.id, userId);
  const back = (
    <Link href="/exams" className="text-sm font-bold text-[color:var(--accent)] hover:underline">
      ← חזרה להכנות למבחנים
    </Link>
  );

  // submitted: the result (only the approved grade, never the rubric)
  if (attempt?.submittedAt) {
    return (
      <PageShell title={exam.title} subtitle="המבחן הוגש">
        <div className="mx-auto max-w-2xl space-y-4">
          {back}
          <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            {attempt.approvedAt ? (
              <>
                <p className="font-display text-2xl font-extrabold text-[color:var(--primary)]">
                  הציון שלך: {attempt.score}
                </p>
                {attempt.feedback && (
                  <p className="whitespace-pre-wrap leading-8">{attempt.feedback}</p>
                )}
              </>
            ) : (
              <p className="leading-8">
                המבחן הוגש בהצלחה ✓ המורה תבדוק, והציון יופיע כאן וגם יישלח אלייך בהתראה.
              </p>
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  // in progress
  if (attempt) {
    return (
      <PageShell title={exam.title} subtitle="המבחן מתנהל — הטיימר רץ">
        <div className="mx-auto max-w-3xl">
          <ExamTaker
            examId={exam.id}
            title={exam.title}
            doc={exam.doc as ExamDoc}
            initialAnswers={attempt.answers}
            deadlineAt={attempt.deadlineAt}
            serverNow={t}
          />
        </div>
      </PageShell>
    );
  }

  // not started: closed until it opens, then an explicit start
  const open = exam.opensAt !== null && t >= exam.opensAt;
  return (
    <PageShell title={exam.title} subtitle="מבחן">
      <div className="mx-auto max-w-xl space-y-4">
        {back}
        <div className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center">
          {open ? (
            <>
              <p className="leading-8">
                זמן המבחן: <b>{exam.durationMin ?? 90} דקות</b>. הטיימר מתחיל ברגע הלחיצה על ״התחלת
                המבחן״ ואי אפשר לעצור אותו. התשובות נשמרות אוטומטית, והמבחן מוגש לבד כשהזמן נגמר.
              </p>
              <StartExamButton examId={exam.id} minutes={exam.durationMin} />
            </>
          ) : (
            <p className="leading-8">
              המבחן עוד לא נפתח.
              {exam.opensAt && (
                <>
                  {" "}
                  הוא ייפתח ב<b>{formatFullDate(exam.opensAt)}</b> בשעה <b>{formatHebTime(exam.opensAt)}</b>.
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
