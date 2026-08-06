// Teacher email whitelist. Everyone else who signs in is a student.
// Add new teachers here — the list is authoritative.
export const TEACHER_EMAILS = new Set<string>([
  "reutst99@gmail.com", // ריעות רוקח
  "refaelbassel@gmail.com", // רפאל באסל
]);

export type UserRole = "student" | "teacher";

export function roleForEmail(email: string | null | undefined): UserRole {
  if (!email) return "student";
  return TEACHER_EMAILS.has(email.toLowerCase()) ? "teacher" : "student";
}
