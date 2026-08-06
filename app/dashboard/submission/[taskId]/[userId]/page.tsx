import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import GradePanel from "@/components/dashboard/grade-panel";
import { db } from "@/lib/db";
import {
  getTask,
  getAnswers,
  getMarkings,
  getProgress,
} from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { formatWorkTime } from "@/lib/hebrew";
import { DECODE_STAGES } from "@/content/tasks/registry";

const MARK_LABEL: Record<string, string> = {
  leitwort: "📌 מילה מנחה",
  hard: "🤔 מילה קשה",
  parallel: "🪞 תקבולת",
  question: "❓ שאלה",
};

// Teacher review of one student's submission: the decoding markings, all
// answers, work time — and the grading panel (Claude proposes, teacher
// edits and approves).
export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ taskId: string; userId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { taskId: rawTask, userId: rawUser } = await params;
  const taskId = Number(rawTask);
  const studentId = Number(rawUser);
  const task = await getTask(taskId);
  if (!task) notFound();
  const reg = getTaskContent(task.content_ref);
  if (!reg) notFound();

  const studentRes = await db().execute({
    sql: "SELECT full_name, email FROM users WHERE id = ?",
    args: [studentId],
  });
  const student = studentRes.rows[0];
  if (!student) notFound();
  const studentName = (student.full_name as string | null) ?? String(student.email);

  const answers = await getAnswers(taskId, studentId);
  const markings = await getMarkings(taskId, studentId);
  const progress = await getProgress(taskId, studentId);

  const questionsRes = await db().execute({
    sql: "SELECT question, created_at FROM question_bank WHERE user_id = ? AND task_id = ? ORDER BY created_at",
    args: [studentId, taskId],
  });

  const gradeRes = await db().execute({
    sql: `SELECT claude_score, claude_feedback, score, feedback, approved_at
          FROM grades WHERE task_id = ? AND user_id = ?`,
    args: [taskId, studentId],
  });
  const grade = gradeRes.rows[0];

  return (
    <PageShell
      title={`הגשה של ${studentName}`}
      subtitle={`${task.title} · ⏱ זמן עבודה בפועל: ${formatWorkTime(progress?.work_seconds ?? 0)} · שלב ${progress?.stage ?? 1}/8`}
    >
      <div className="mx-auto max-w-3xl space-y-8">
        {/* decoding markings */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            🔍 פענוח הטקסט
          </h2>
          {markings.length === 0 ? (
            <p className="text-sm text-[color:var(--foreground)]/55">לא נשמרו סימונים.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {markings.map((m, i) => (
                <span
                  key={i}
                  className="rounded-full border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1 text-xs"
                  title={m.note ?? undefined}
                >
                  {MARK_LABEL[m.kind] ?? m.kind}: <b>{m.wordText}</b>
                </span>
              ))}
            </div>
          )}
          {questionsRes.rows.length > 0 && (
            <>
              <h3 className="mb-2 mt-4 text-xs font-bold text-[color:var(--primary)]/70">
                ❓ השאלות שנכנסו למאגר האישי במשימה זו
              </h3>
              <ul className="space-y-1">
                {questionsRes.rows.map((q, i) => (
                  <li key={i} className="rounded-lg bg-[color:var(--primary)]/5 px-3 py-1.5 text-sm">
                    {String(q.question)}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* decode stage answers */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            🪜 תשובות שלבי הפענוח
          </h2>
          <div className="space-y-3">
            {[
              ["decode:leitwort-why", `${DECODE_STAGES[1].title} — למה היא חוזרת?`],
              ["decode:genre", DECODE_STAGES[3].title],
              ["decode:genre-help", "לפי מה זוהתה הסוגה?"],
              ["decode:parallelism", "תקבולת (אם נפתחה)"],
              ["decode:retell", DECODE_STAGES[5].title],
            ].map(([key, label]) => (
              <AnswerRow key={key} label={label} value={answers[key]} />
            ))}
          </div>
        </section>

        {/* worksheet answers */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            📝 תשובות המשימה
          </h2>
          <div className="space-y-4">
            {reg.content.sections.map((section) => (
              <div key={section.key}>
                <h3 className="mb-2 text-xs font-bold text-[color:var(--accent)]">
                  {section.title}
                </h3>
                <div className="space-y-3">
                  {section.blocks.map((block) => {
                    if (block.type !== "question") return null;
                    if (block.fields) {
                      return block.fields.map((f) => (
                        <AnswerRow
                          key={`${block.key}:${f.key}`}
                          label={`${block.prompt} — ${f.label}`}
                          value={answers[`${block.key}:${f.key}`]}
                        />
                      ));
                    }
                    return (
                      <AnswerRow key={block.key} label={block.prompt} value={answers[block.key]} />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* grading */}
        <GradePanel
          taskId={taskId}
          studentId={studentId}
          studentName={studentName}
          initialClaudeScore={grade?.claude_score != null ? Number(grade.claude_score) : null}
          initialClaudeFeedback={(grade?.claude_feedback as string | null) ?? null}
          initialScore={grade?.score != null ? Number(grade.score) : null}
          initialFeedback={(grade?.feedback as string | null) ?? null}
          approved={grade?.approved_at != null}
        />
      </div>
    </PageShell>
  );
}

function AnswerRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="rounded-xl bg-[color:var(--background)] px-4 py-3">
      <p className="mb-1 text-xs font-semibold text-[color:var(--primary)]/65">{label}</p>
      {value?.trim() ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
          {value}
        </p>
      ) : (
        <p className="text-sm text-[color:var(--danger)]/70">(לא נענתה)</p>
      )}
    </div>
  );
}
