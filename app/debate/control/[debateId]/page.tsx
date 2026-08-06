import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import ControlPanel from "@/components/debate/control-panel";
import { getDebate } from "@/lib/debate";

export default async function DebateControlPage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/debate");

  const { debateId } = await params;
  const debate = await getDebate(Number(debateId));
  if (!debate) notFound();

  return (
    <PageShell title={`🎛️ שלט המורה`} subtitle={debate.title}>
      <div className="mx-auto max-w-md">
        <ControlPanel debateId={debate.id} />
      </div>
    </PageShell>
  );
}
