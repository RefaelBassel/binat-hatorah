import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import PageShell from "@/components/page-shell";
import ExamRunner from "@/components/exams/exam-runner";
import { examBodyOf, getAttempt, getDoc, now } from "@/lib/exams";
import { answerItems, stripRubric } from "@/lib/exam-types";

export const dynamic = "force-dynamic";

export default async function StudentExamPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const { id } = await params;
  if (user.role === "teacher" && !user.guest) {
    const { isStudentMode } = await import("@/lib/student-mode");
    if (!(await isStudentMode())) redirect(`/dashboard/exams/${id}`);
  }
  const exam = await getDoc(Number(id));
  if (!exam || exam.kind !== "exam" || exam.publishedAt == null) notFound();
  const attempt = user.guest ? null : await getAttempt(exam.id, Number(user.id));
  const body = examBodyOf(exam);
  // students never receive the marking guide
  const items = answerItems(body).map((it) => ({ key: it.key, maxPoints: it.maxPoints }));

  return (
    <PageShell title={exam.title}>
      <ExamRunner
        examId={exam.id}
        title={exam.title}
        durationMin={exam.durationMin ?? 90}
        opensAt={exam.opensAt}
        body={stripRubric(body)}
        items={items}
        serverNow={now()}
        guest={Boolean(user.guest)}
        attempt={
          attempt
            ? {
                startedAt: attempt.startedAt,
                deadlineAt: attempt.deadlineAt,
                submittedAt: attempt.submittedAt,
                answers: attempt.answers,
                approved: attempt.approvedAt != null,
                score: attempt.approvedAt != null ? attempt.score : null,
                feedback: attempt.approvedAt != null ? attempt.feedback : null,
                points: attempt.approvedAt != null ? attempt.points : null,
              }
            : null
        }
      />
    </PageShell>
  );
}
