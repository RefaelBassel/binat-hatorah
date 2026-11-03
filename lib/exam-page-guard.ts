import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Teacher-only pages of the exams area: students (and teachers in student
// mode, and the read-only guest) never get in.
export async function requireTeacherPage(): Promise<number> {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher" || user.guest) redirect("/");
  const { isStudentMode } = await import("@/lib/student-mode");
  if (await isStudentMode()) redirect("/exams");
  return Number(user.id);
}
