import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import ExamGrader from "@/components/exams/exam-grader";
import { requireTeacherPage } from "@/lib/exam-page-guard";
import { attemptsForExam, examBodyOf, getDoc } from "@/lib/exams";
import { answerItems } from "@/lib/exam-types";

export const dynamic = "force-dynamic";

export default async function ExamSubmissionPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  await requireTeacherPage();
  const { id, userId } = await params;
  const exam = await getDoc(Number(id));
  if (!exam || exam.kind !== "exam") notFound();
  const attempt = (await attemptsForExam(exam.id)).find((a) => a.userId === Number(userId));
  if (!attempt) notFound();
  const body = examBodyOf(exam);

  return (
    <PageShell title={`${attempt.name} · ${exam.title}`}>
      <p className="mb-4 text-center">
        <Link href={`/dashboard/exams/${exam.id}/submissions`} className="text-sm font-semibold text-[color:var(--primary)] underline">
          ← לכל ההגשות
        </Link>
      </p>
      <ExamGrader
        examId={exam.id}
        userId={attempt.userId}
        body={body}
        items={answerItems(body)}
        answers={attempt.answers}
        submitted={attempt.submittedAt != null}
        claudePoints={attempt.claudePoints}
        claudeFeedback={attempt.claudeFeedback}
        claudeError={attempt.claudeError}
        approvedPoints={attempt.points}
        approvedFeedback={attempt.feedback}
        approvedScore={attempt.approvedAt != null ? attempt.score : null}
      />
    </PageShell>
  );
}
