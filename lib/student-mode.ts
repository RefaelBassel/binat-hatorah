import { cookies } from "next/headers";

// "מצב תלמיד" — teachers (Rafael + Reut) can experience the whole site
// exactly as a student, including actually doing tasks. Cookie-based toggle;
// teacher progress rows are excluded from real student stats (assignments
// only ever reference students). The set/clear actions live in top-nav.tsx
// (server actions must be defined in a server-action context).
export const STUDENT_MODE_COOKIE = "bh_student_mode";

export async function isStudentMode(): Promise<boolean> {
  return (await cookies()).get(STUDENT_MODE_COOKIE)?.value === "1";
}
