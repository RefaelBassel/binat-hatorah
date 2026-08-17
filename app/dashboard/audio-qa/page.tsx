import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import AudioQa from "@/components/audio-qa";

// Teacher-only audit board for verse-audio timestamps.
export default async function AudioQaPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  const { isStudentMode } = await import("@/lib/student-mode");
  if (await isStudentMode()) redirect("/");

  return (
    <PageShell
      title="ביקורת השמעת פסוקים"
      subtitle="כל פרק ממופה, פסוק-פסוק — האזינו ובדקו שההתחלה והסוף נקיים"
    >
      <div className="mx-auto max-w-3xl">
        <AudioQa />
      </div>
    </PageShell>
  );
}
