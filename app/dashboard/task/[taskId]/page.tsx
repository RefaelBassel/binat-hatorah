import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import PageShell from "@/components/page-shell";
import ClassPulseDrawer from "@/components/class-pulse-drawer";
import ConfirmButton from "@/components/confirm-button";
import {
  getTask,
  taskRoster,
  STATUS_META,
  isTaskCancelled,
  cancelTaskAssignment,
  republishTask,
  updateTaskDueDate,
} from "@/lib/tasks";
import {
  formatHebDate,
  formatHebTime,
  formatWorkTime,
  israelWallTimeToUnix,
} from "@/lib/hebrew";

async function requireTeacherAction() {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.role !== "teacher" || user.guest) return null;
  return user;
}

// Teacher view of one task: full roster, color-coded statuses (including
// טרם נלמדה), work time, progress, and links into each submission.
export default async function DashboardTaskPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { taskId: raw } = await params;
  const taskId = Number(raw);
  const task = await getTask(taskId);
  if (!task) notFound();
  const cancelled = await isTaskCancelled(taskId);

  // ----- management actions (teacher-only, verified inside each action) -----
  async function changeDueDate(formData: FormData) {
    "use server";
    if (!(await requireTeacherAction())) return;
    const dueDate = String(formData.get("dueDate") ?? "");
    const dueTimeRaw = String(formData.get("dueTime") ?? "");
    const dueTime = /^\d{2}:\d{2}$/.test(dueTimeRaw) ? dueTimeRaw : "23:59";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return;
    await updateTaskDueDate(taskId, israelWallTimeToUnix(dueDate, dueTime));
    revalidatePath(`/dashboard/task/${taskId}`);
    revalidatePath("/dashboard");
  }

  async function cancelForClass() {
    "use server";
    if (!(await requireTeacherAction())) return;
    await cancelTaskAssignment(taskId);
    revalidatePath(`/dashboard/task/${taskId}`);
    revalidatePath("/dashboard");
  }

  async function republishForClass() {
    "use server";
    if (!(await requireTeacherAction())) return;
    await republishTask(taskId);
    revalidatePath(`/dashboard/task/${taskId}`);
    revalidatePath("/dashboard");
  }

  // current due date+time in Israel time, for the form inputs
  const dueDateValue = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(task.due_at * 1000));
  const dueTimeValue = formatHebTime(task.due_at);

  const roster = await taskRoster(taskId);
  const groups = {
    submitted: roster.filter((r) => r.status === "submitted"),
    graded: roster.filter((r) => r.status === "graded"),
    in_progress: roster.filter((r) => r.status === "in_progress"),
    overdue: roster.filter((r) => r.status === "overdue"),
    not_started: roster.filter((r) => r.status === "not_started"),
  };

  return (
    <PageShell
      title={task.title}
      subtitle={`להגשה עד ${formatHebDate(task.due_at)} בשעה ${formatHebTime(task.due_at)} · ${roster.length} בכיתה`}
    >
      <ClassPulseDrawer taskId={task.id} />
      <p className="mb-6 flex items-center justify-center gap-5 text-center">
        <Link
          href={`/tasks/${taskId}`}
          className="text-sm font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          👀 צפייה במשימה כפי שהכיתה רואה אותה ←
        </Link>
        <Link
          href={`/dashboard/class-board/${taskId}`}
          target="_blank"
          className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
        >
          🖥️ לוח כיתה להקרנה
        </Link>
      </p>

      {/* ===== task management: due date + cancellation ===== */}
      {cancelled ? (
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border-2 border-[color:var(--danger)]/40 bg-[color:var(--danger)]/5 p-5">
          <div>
            <p className="font-display text-base font-bold text-[color:var(--danger)]">
              🚫 המשימה מבוטלת
            </p>
            <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
              היא אינה מוצגת לאף תלמיד/ה. כל העבודות שנשמרו — נשמרות, ויחזרו
              עם הפרסום מחדש.
            </p>
          </div>
          <form action={republishForClass}>
            <button
              type="submit"
              className="rounded-full bg-[color:var(--primary)] px-6 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
            >
              📣 פרסום מחדש לכל הכיתה
            </button>
          </form>
        </div>
      ) : (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <p className="mb-2 text-sm font-bold text-[color:var(--primary)]">
              📅 תאריך אחרון להגשה
            </p>
            <form action={changeDueDate} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                name="dueDate"
                defaultValue={dueDateValue}
                required
                className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <input
                type="time"
                name="dueTime"
                defaultValue={dueTimeValue}
                className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
              />
              <button
                type="submit"
                className="rounded-full bg-[color:var(--primary)] px-5 py-1.5 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
              >
                עדכון
              </button>
            </form>
            <p className="mt-2 text-[11px] text-[color:var(--primary)]/55">
              כרגע: {formatHebDate(task.due_at)} בשעה {formatHebTime(task.due_at)} ·
              השינוי חל מיד על כל הכיתה
            </p>
          </div>

          <div className="rounded-2xl border border-[color:var(--danger)]/30 bg-[color:var(--card)] p-5">
            <p className="mb-2 text-sm font-bold text-[color:var(--danger)]">
              🚫 ביטול ההקצאה
            </p>
            <p className="mb-3 text-[11px] leading-5 text-[color:var(--foreground)]/65">
              המשימה תוסר מכל התלמידים ולא תופיע אצלם. העבודות שכבר נשמרו
              לא נמחקות — ואפשר לפרסם מחדש בכל רגע.
            </p>
            <form action={cancelForClass}>
              <ConfirmButton
                message={`לבטל את ההקצאה של ״${task.title}״ לכל הכיתה? המשימה תוסר מכל התלמידים (העבודות שנשמרו יישארו, ואפשר לפרסם מחדש).`}
                className="rounded-full border-2 border-[color:var(--danger)]/60 px-5 py-1.5 text-sm font-bold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10"
              >
                ביטול ההקצאה לכל הכיתה
              </ConfirmButton>
            </form>
          </div>
        </div>
      )}

      {(
        [
          ["submitted", "📬 הוגשו — ממתינות לבדיקה"],
          ["graded", "✅ נבדקו ואושרו"],
          ["overdue", "⏰ עבר זמנן ולא הוגשו"],
          ["in_progress", "✏️ בלימוד"],
          ["not_started", "🌱 טרם נלמדו"],
        ] as const
      ).map(([key, heading]) =>
        groups[key].length === 0 ? null : (
          <section key={key} className="mb-8">
            <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
              {heading} ({groups[key].length})
            </h2>
            <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border)] text-right text-[11px] text-[color:var(--primary)]/60">
                    <th className="px-4 py-2.5 font-semibold">תלמידה</th>
                    <th className="px-4 py-2.5 font-semibold">סטטוס</th>
                    <th className="px-4 py-2.5 font-semibold">התקדמות</th>
                    <th className="px-4 py-2.5 font-semibold">זמן עבודה</th>
                    <th className="px-4 py-2.5 font-semibold">ציון</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {groups[key].map((r) => {
                    const meta = STATUS_META[r.status];
                    return (
                      <tr
                        key={r.userId}
                        className="border-b border-[color:var(--border)]/50 last:border-0"
                      >
                        <td className="px-4 py-2.5 font-semibold text-[color:var(--primary)]">
                          {r.fullName}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="rounded-full px-2.5 py-0.5 text-[11px] font-bold"
                            style={{ background: meta.bg, color: meta.color }}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-[color:var(--border)]/60">
                              <div
                                className="h-full rounded-full bg-[color:var(--accent)]"
                                style={{ width: `${r.progressPct}%` }}
                              />
                            </div>
                            <span className="text-[11px]">{r.progressPct}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-[color:var(--primary)]/70">
                          {r.workSeconds > 0 ? formatWorkTime(r.workSeconds) : "—"}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-[color:var(--primary)]">
                          {r.score ?? (r.claudeScore != null ? `(${r.claudeScore})` : "—")}
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={`/dashboard/submission/${taskId}/${r.userId}`}
                            className="rounded-lg border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
                          >
                            {r.status === "submitted" ? "לבדיקה ✨" : "צפייה"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      )}
    </PageShell>
  );
}
