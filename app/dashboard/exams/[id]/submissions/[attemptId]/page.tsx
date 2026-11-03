import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import GradeForm from "@/components/exams/grade-form";
import { requireTeacherPage } from "@/lib/exams-page";
import { getAttemptById, getExam } from "@/lib/exams";
import { db } from "@/lib/db";
import { examUnits, type ExamDoc } from "@/lib/exams-types";

export default async function ExamGradePage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  await requireTeacherPage();
  const { id: rawId, attemptId: rawAttempt } = await params;
  const examId = Number(rawId);
  const exam = Number.isInteger(examId) ? await getExam(examId) : null;
  if (!exam || exam.kind !== "exam") notFound();
  const attempt = await getAttemptById(Number(rawAttempt));
  if (!attempt || attempt.examId !== examId) notFound();

  const student = await db().execute({
    sql: "SELECT full_name, email FROM users WHERE id = ?",
    args: [attempt.userId],
  });
  const name =
    (student.rows[0]?.full_name as string | null) ?? String(student.rows[0]?.email ?? "תלמיד/ה");
  const doc = exam.doc as ExamDoc;

  return (
    <PageShell title={`בדיקת מבחן — ${name}`} subtitle={exam.title}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link
          href={`/dashboard/exams/${examId}/submissions`}
          className="text-sm font-bold text-[color:var(--accent)] hover:underline"
        >
          ← לכל ההגשות
        </Link>
        <GradeForm
          examId={examId}
          attemptId={attempt.id}
          units={examUnits(doc).map((u) => ({
            key: u.key,
            label: u.label,
            text: u.text,
            rubric: u.rubric,
            max: u.max,
          }))}
          // the structure is needed client-side to compute the live total
          // (choice parts, per-question caps)
          doc={doc}
          answers={attempt.answers}
          submitted={attempt.submittedAt !== null}
          initialScores={attempt.scores ?? attempt.claudeScores ?? {}}
          scoresAreFromClaude={attempt.scores === null && attempt.claudeScores !== null}
          claudeError={attempt.claudeError}
          initialFeedback={attempt.feedback ?? attempt.claudeFeedback ?? ""}
          approvedAt={attempt.approvedAt}
          approvedScore={attempt.score}
        />
      </div>
    </PageShell>
  );
}
