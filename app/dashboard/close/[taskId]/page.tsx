import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getTask } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "@/lib/content-overrides";
import ClosingConsole from "@/components/closing-console";

// מסך הסגירה — teacher only, chrome-free. The moment before the closing:
// the live understanding picture on top and BOTH ways to close ready side
// by side — re-teach the weak part (with a Claude-written aid for her) or
// run the plenary question (with the questions the students themselves
// asked). Nothing is decided automatically; she chooses, and either card
// projects full-screen.
export default async function ClosingPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { taskId: raw } = await params;
  const task = await getTask(Number(raw));
  if (!task) notFound();
  const baseReg = getTaskContent(task.content_ref);
  if (!baseReg) notFound();
  const content = await effectiveContent(baseReg.content);

  // the harvest: questions students banked while decoding this task
  const qRes = await db().execute({
    sql: `SELECT q.question, u.full_name, u.email
          FROM question_bank q JOIN users u ON u.id = q.user_id
          WHERE q.task_id = ? AND u.role = 'student'
          ORDER BY q.created_at DESC LIMIT 40`,
    args: [task.id],
  });
  const studentQuestions = qRes.rows.map((r) => ({
    question: String(r.question),
    name: (r.full_name as string | null) ?? String(r.email),
  }));

  return (
    <ClosingConsole
      taskId={task.id}
      contentRef={content.ref}
      title={content.title}
      bookRef={content.bookRef}
      hasCheck={Boolean(content.check?.length)}
      plenary={content.plenary ?? null}
      studentQuestions={studentQuestions}
      verses={baseReg.mainPassage.verses}
      passageRef={baseReg.mainPassage.ref}
    />
  );
}
