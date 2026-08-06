import Link from "next/link";
import { auth } from "@/auth";
import { continueTask } from "@/lib/tasks";
import { isStudentMode } from "@/lib/student-mode";

// Floating action button — one tap to the task you're in the middle of
// (or the next one to start). Students spend most of their time there.
// Sits at the bottom inline-start corner (right, in RTL); the reflection
// drawer owns the opposite edge.
export default async function ContinueFab() {
  const session = await auth();
  const user = session?.user;
  if (!user || user.guest) return null;

  const teacherAsStudent = user.role === "teacher" && (await isStudentMode());
  if (user.role === "teacher" && !teacherAsStudent) return null;

  let next: Awaited<ReturnType<typeof continueTask>> = null;
  try {
    next = await continueTask(Number(user.id), teacherAsStudent);
  } catch {
    return null;
  }
  if (!next) return null;

  const label =
    next.status === "in_progress" || next.status === "overdue"
      ? "ממשיכים במשימה"
      : "מתחילים משימה";

  return (
    <Link
      href={`/tasks/${next.id}`}
      className="fixed bottom-5 z-40 flex items-center gap-2 rounded-full px-5 py-3 text-sm font-bold text-white shadow-xl transition hover:scale-[1.03]"
      style={{ insetInlineStart: "1rem", background: "var(--accent)" }}
      title={next.title}
    >
      <span aria-hidden>▶️</span>
      <span>{label}</span>
      {next.progressPct > 0 && (
        <span className="rounded-full bg-white/25 px-2 py-0.5 text-[11px] tabular-nums">
          {next.progressPct}%
        </span>
      )}
    </Link>
  );
}
