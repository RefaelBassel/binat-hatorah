import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Page guard for the teacher-only exams area: signed-in teacher who is not in
// "student mode". Everyone else is sent away — students never see these pages.
export async function requireTeacherPage(): Promise<{ userId: number; name: string | null }> {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher" || user.guest) redirect("/");
  const { isStudentMode } = await import("@/lib/student-mode");
  if (await isStudentMode()) redirect("/");
  return { userId: Number(user.id), name: user.fullName ?? null };
}
