import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import Chat, { type Contact } from "@/components/messages/chat";
import {
  listTeachers,
  loadThreadsFor,
  getGroupUnreadCount,
} from "@/lib/messages";
import { allStudents } from "@/lib/tasks";
import { isStudentMode } from "@/lib/student-mode";

export default async function MessagesPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");

  if (user.guest) {
    return (
      <PageShell title="קשר" subtitle="שיח אישי וקבוצתי עם המורה">
        <p className="text-center text-sm text-[color:var(--foreground)]/60">
          במצב צפייה אין גישה להודעות.
        </p>
      </PageShell>
    );
  }

  const userId = Number(user.id);
  const meName = user.fullName ?? user.name ?? "";
  const studentMode = user.role === "teacher" && (await isStudentMode());
  const isTeacher = user.role === "teacher" && !studentMode;

  const contacts: Contact[] = [];
  try {
    const threads = await loadThreadsFor(userId);
    const unreadBy = new Map(threads.map((t) => [t.otherUserId, t.unreadCount]));
    const groupUnread = await getGroupUnreadCount(userId);
    contacts.push({
      id: "group",
      name: "קבוצת הכיתה",
      role: "group",
      unread: groupUnread,
    });

    if (isTeacher) {
      // Group + every student (sorted by recent activity via threads order).
      const students = await allStudents();
      const byActivity = new Map(threads.map((t, i) => [t.otherUserId, i]));
      students.sort(
        (a, b) => (byActivity.get(a.id) ?? 999) - (byActivity.get(b.id) ?? 999)
      );
      for (const s of students) {
        contacts.push({
          id: s.id,
          name: s.fullName,
          role: "student",
          unread: unreadBy.get(s.id) ?? 0,
        });
      }
    } else {
      const teachers = await listTeachers();
      for (const t of teachers) {
        if (t.id === userId) continue;
        contacts.push({
          id: t.id,
          name: t.fullName ?? t.email,
          role: "teacher",
          unread: unreadBy.get(t.id) ?? 0,
        });
      }
    }
  } catch {
    // DB unavailable
  }

  return (
    <PageShell
      title="קשר"
      subtitle={
        isTeacher
          ? "שיחה אישית עם כל תלמיד ותלמידה ושיח קבוצתי עם כל הכיתה"
          : "שיחה אישית עם המורות ושיח קבוצתי עם כל הכיתה"
      }
    >
      <div className="mx-auto max-w-4xl">
        <Chat contacts={contacts} meId={userId} meName={meName} />
      </div>
    </PageShell>
  );
}
