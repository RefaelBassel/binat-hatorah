import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getTask } from "@/lib/tasks";
import { getTaskContent } from "@/content/tasks/registry";
import { effectiveContent } from "@/lib/content-overrides";
import OpeningDeckPlayer from "@/components/opening-deck";

// אור פותח — the teacher's opening deck for a task. Teacher only,
// chrome-free (the player is a fixed full-viewport overlay).
export default async function OpeningPage({
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

  return (
    <OpeningDeckPlayer
      taskId={task.id}
      contentRef={content.ref}
      title={content.title}
      subtitle={content.subtitle}
      bookRef={content.bookRef}
      opening={content.opening ?? null}
      plenary={content.plenary ?? null}
    />
  );
}
