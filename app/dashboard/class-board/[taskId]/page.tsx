import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getTask } from "@/lib/tasks";
import ClassBoard from "@/components/class-board";

// The projectable class board — teacher only, chrome-free (no nav/footer
// clutter on the classroom projector).
export default async function ClassBoardPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { taskId } = await params;
  const task = await getTask(Number(taskId));
  if (!task) notFound();

  return <ClassBoard taskId={task.id} />;
}
