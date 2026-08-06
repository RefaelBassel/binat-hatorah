import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import VotePanel from "@/components/debate/vote-panel";
import { getDebate } from "@/lib/debate";

export default async function DebateVotePage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { debateId } = await params;
  const debate = await getDebate(Number(debateId));
  if (!debate) notFound();

  return (
    <PageShell title="🗳️ הצבעת הקהל" subtitle={debate.title}>
      <div className="mx-auto max-w-md">
        <VotePanel debateId={debate.id} />
      </div>
    </PageShell>
  );
}
