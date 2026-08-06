import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LiveBoard from "@/components/debate/live-board";

// The projected board — full screen, no site chrome (it lives on the class
// projector). Any logged-in user may view it.
export default async function DebateLivePage({
  params,
}: {
  params: Promise<{ debateId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { debateId } = await params;
  return <LiveBoard debateId={Number(debateId)} />;
}
