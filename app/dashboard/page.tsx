import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import { db } from "@/lib/db";
import { allStudents, allTasksWithStats, now } from "@/lib/tasks";
import { sweepOverdue } from "@/lib/notify";
import { TASK_REGISTRY } from "@/content/tasks/registry";
import { formatHebDate } from "@/lib/hebrew";
import { revalidatePath } from "next/cache";

export default async function DashboardPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  const { isStudentMode } = await import("@/lib/student-mode");
  if (await isStudentMode()) redirect("/");
  const isGuest = Boolean(user.guest);

  let students: Awaited<ReturnType<typeof allStudents>> = [];
  let tasks: Awaited<ReturnType<typeof allTasksWithStats>> = [];
  let reflections: {
    name: string;
    contextRef: string | null;
    difficulty: number;
    pshat: number;
    argument: number;
    note: string | null;
    createdAt: number;
  }[] = [];
  let writingStats: { name: string; done: number; avg: number | null }[] = [];
  try {
    await sweepOverdue();
    students = await allStudents();
    tasks = await allTasksWithStats();
    const refRes = await db().execute({
      sql: `SELECT u.full_name, u.email, r.context_ref, r.difficulty, r.pshat_progress,
                   r.argument_progress, r.note, r.created_at
            FROM reflections r JOIN users u ON u.id = r.user_id
            WHERE u.role = 'student'
            ORDER BY r.created_at DESC LIMIT 25`,
      args: [],
    });
    const wrRes = await db().execute({
      sql: `SELECT u.full_name, u.email, COUNT(*) AS done, AVG(w.score) AS avg_score
            FROM writing_results w JOIN users u ON u.id = w.user_id
            WHERE u.role = 'student'
            GROUP BY w.user_id ORDER BY done DESC`,
      args: [],
    });
    writingStats = wrRes.rows.map((r) => ({
      name: (r.full_name as string | null) ?? String(r.email),
      done: Number(r.done),
      avg: r.avg_score != null ? Math.round(Number(r.avg_score)) : null,
    }));
    reflections = refRes.rows.map((r) => ({
      name: (r.full_name as string | null) ?? String(r.email),
      contextRef: (r.context_ref as string | null) ?? null,
      difficulty: Number(r.difficulty),
      pshat: Number(r.pshat_progress),
      argument: Number(r.argument_progress),
      note: (r.note as string | null) ?? null,
      createdAt: Number(r.created_at),
    }));
  } catch {
    // DB unavailable
  }

  async function publishTask(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "teacher" || session.user.guest) return;
    const contentRef = String(formData.get("contentRef") ?? "");
    const dueDate = String(formData.get("dueDate") ?? "");
    if (!TASK_REGISTRY[contentRef] || !dueDate) return;
    const t = now();
    const dueAt = Math.floor(new Date(`${dueDate}T23:59:00+03:00`).getTime() / 1000);
    const title = TASK_REGISTRY[contentRef].content.title;
    const teacherId = Number(session.user.id);

    const res = await db().execute({
      sql: `INSERT INTO tasks (content_ref, title, published_at, due_at, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [contentRef, title, t, dueAt, teacherId, t],
    });
    const taskId = Number(res.lastInsertRowid);

    // Assign to all onboarded students.
    const studentRows = await db().execute({
      sql: "SELECT id FROM users WHERE role = 'student' AND onboarded_at IS NOT NULL",
      args: [],
    });
    for (const r of studentRows.rows) {
      await db().execute({
        sql: `INSERT OR IGNORE INTO task_assignments (task_id, user_id, assigned_at)
              VALUES (?, ?, ?)`,
        args: [taskId, Number(r.id), t],
      });
    }
    revalidatePath("/dashboard");
    revalidatePath("/tasks");
  }

  const publishedRefs = new Set(tasks.map((t) => t.contentRef));
  const availableRefs = Object.entries(TASK_REGISTRY).filter(
    ([ref]) => !publishedRefs.has(ref)
  );

  return (
    <PageShell
      title="דשבורד מורה"
      subtitle="כלל המשימות, ההגשות והתלמידות — במקום אחד"
    >
      {/* stats */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="תלמידות רשומות" value={students.length} emoji="👩‍🎓" />
        <Stat label="משימות פורסמו" value={tasks.length} emoji="📚" />
        <Stat
          label="הגשות ממתינות לבדיקה"
          value={tasks.reduce((s, t) => s + (t.submitted - t.graded), 0)}
          emoji="📬"
        />
        <Stat
          label="נבדקו ואושרו"
          value={tasks.reduce((s, t) => s + t.graded, 0)}
          emoji="✅"
        />
      </div>

      {/* publish new task */}
      <div className="mb-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
        <h2 className="mb-3 font-display text-lg font-bold text-[color:var(--primary)]">
          📤 פרסום משימה חדשה
        </h2>
        {availableRefs.length === 0 ? (
          <p className="text-sm text-[color:var(--foreground)]/60">
            כל המשימות שבספריית התוכן כבר פורסמו. משימות חדשות ייווצרו יחד עם קלוד
            מתוך חומרי המקור.
          </p>
        ) : isGuest ? (
          <p className="text-sm text-[color:var(--foreground)]/60">
            במצב צפייה לא ניתן לפרסם משימות.
          </p>
        ) : (
          <form action={publishTask} className="flex flex-wrap items-end gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
                משימה מספריית התוכן
              </span>
              <select
                name="contentRef"
                className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
              >
                {availableRefs.map(([ref, reg]) => (
                  <option key={ref} value={ref}>
                    {reg.content.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
                תאריך אחרון להגשה
              </span>
              <input
                type="date"
                name="dueDate"
                required
                className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-[color:var(--primary)] px-6 py-2.5 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
            >
              פרסום והקצאה לכל התלמידות
            </button>
          </form>
        )}
      </div>

      {/* recent reflections */}
      <div className="mb-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
        <h2 className="mb-3 font-display text-lg font-bold text-[color:var(--primary)]">
          🪞 רפלקציות אחרונות של התלמידות
        </h2>
        {reflections.length === 0 ? (
          <p className="text-sm text-[color:var(--foreground)]/60">
            עדיין אין רפלקציות. כל רפלקציה שתלמידה תמלא — תופיע כאן עם ההקשר המלא.
          </p>
        ) : (
          <ul className="max-h-72 space-y-2 overflow-y-auto">
            {reflections.map((r, i) => (
              <li key={i} className="rounded-xl bg-[color:var(--background)] px-4 py-2.5 text-xs leading-6">
                <p>
                  <b className="text-[color:var(--primary)]">{r.name}</b>
                  <span className="text-[10px] text-[color:var(--primary)]/50">
                    {" "}·{" "}
                    {new Intl.DateTimeFormat("he-IL", {
                      weekday: "long",
                      day: "numeric",
                      month: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(r.createdAt * 1000))}
                    {r.contextRef && ` · ${r.contextRef}`}
                  </span>
                </p>
                <p className="mt-0.5 flex flex-wrap gap-3">
                  <span>🌡️ קושי: <b>{r.difficulty}</b></span>
                  <span>📖 פשט: <b>{r.pshat}</b></span>
                  <span>⚖️ טיעון: <b>{r.argument}</b></span>
                </p>
                {r.note && <p className="mt-1 text-[color:var(--foreground)]/75">💬 {r.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* writing practice stats */}
      <div className="mb-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
        <h2 className="mb-3 font-display text-lg font-bold text-[color:var(--primary)]">
          ✍️ תרגול כתיבה טיעונית
        </h2>
        {writingStats.length === 0 ? (
          <p className="text-sm text-[color:var(--foreground)]/60">
            עדיין אין תרגולים. כשתלמידה תתרגל — הציונים יופיעו כאן.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {writingStats.map((w) => (
              <span
                key={w.name}
                className="rounded-full bg-[color:var(--background)] px-3.5 py-1.5 text-xs"
              >
                <b className="text-[color:var(--primary)]">{w.name}</b> · {w.done} תרגולים
                {w.avg != null && <> · ממוצע <b>{w.avg}</b></>}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* task list */}
      <h2 className="mb-4 font-display text-lg font-bold text-[color:var(--primary)]">
        📚 המשימות
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-[color:var(--foreground)]/60">
          עדיין לא פורסמו משימות.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {tasks.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard/task/${t.id}`}
              className="group block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm transition hover:border-[color:var(--accent)]/60 hover:shadow-md"
            >
              <h3 className="font-display text-base font-bold text-[color:var(--primary)]">
                {t.title}
              </h3>
              <p className="mt-1 text-xs text-[color:var(--primary)]/55">
                📅 פורסמה {formatHebDate(t.publishedAt)} · להגשה עד {formatHebDate(t.dueAt)}
              </p>
              <div className="mt-3 flex gap-2 text-[11px] font-bold">
                <span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-[color:var(--primary)]">
                  👥 {t.assigned}
                </span>
                <span className="rounded-full bg-[#e3edf7] px-3 py-1 text-[#2f5d8a]">
                  📬 {t.submitted} הוגשו
                </span>
                <span className="rounded-full bg-[color:var(--success)]/15 px-3 py-1 text-[color:var(--success)]">
                  ✅ {t.graded} נבדקו
                </span>
                {t.submitted - t.graded > 0 && (
                  <span className="rounded-full bg-[color:var(--warning)]/15 px-3 py-1 text-[color:var(--warning)]">
                    ⏳ {t.submitted - t.graded} לבדיקה
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </PageShell>
  );
}

function Stat({ label, value, emoji }: { label: string; value: number; emoji: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center">
      <p className="text-2xl">{emoji}</p>
      <p className="font-display text-2xl font-extrabold text-[color:var(--primary)]">{value}</p>
      <p className="text-[11px] text-[color:var(--primary)]/60">{label}</p>
    </div>
  );
}
