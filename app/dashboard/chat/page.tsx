import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import TeacherChat from "@/components/dashboard/teacher-chat";

// ריעות ↔ קלוד — the teacher writes here whatever she wants changed in the
// site, and it happens: content and settings through the site's own actions
// (after her ✓), code through the build pipeline. Teachers only.
export default async function TeacherChatPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  return (
    <PageShell title="הצ׳אט עם קלוד" subtitle="כותבים מה לשנות — וזה קורה">
      <div className="mx-auto max-w-3xl">
        <TeacherChat teacherName={user.fullName ?? null} />
      </div>
    </PageShell>
  );
}
