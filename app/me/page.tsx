import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TopNav from "@/components/top-nav";
import ReflectionDrawer from "@/components/reflection-drawer";
import QuestionBank from "@/components/question-bank";
import ReflectionGraph, { type ReflectionPoint } from "@/components/reflection-graph";
import { db } from "@/lib/db";
import { tasksForStudent, STATUS_META } from "@/lib/tasks";
import { unreadFor, markAllRead } from "@/lib/notify";
import { formatHebDate, formatWorkTime } from "@/lib/hebrew";

// Personal page — strongly visual learning status (in the spirit of the
// אמונה site journey): overdue alerts, the current task + its due date,
// the learning journey, question bank, products, and notifications.
export default async function MePage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (!user.guest && !user.onboarded) redirect("/onboarding");
  const userId = Number(user.id);
  const name = user.fullName ?? user.name ?? "";
  const { isStudentMode } = await import("@/lib/student-mode");
  const studentMode = user.role === "teacher" && (await isStudentMode());
  const isTeacher = user.role === "teacher" && !studentMode;

  let tasks: Awaited<ReturnType<typeof tasksForStudent>> = [];
  let questions: { id: number; question: string; starred: boolean; chosen: boolean }[] = [];
  let notifications: Awaited<ReturnType<typeof unreadFor>> = [];
  let roles: { productKey: string; title: string; role: string }[] = [];
  let reflections: (ReflectionPoint & { contextRef: string | null; note: string | null })[] = [];

  try {
    if (!user.guest) {
      tasks = await tasksForStudent(userId, studentMode);
      const qRes = await db().execute({
        sql: `SELECT id, question, starred, chosen_for_seminar FROM question_bank
              WHERE user_id = ? ORDER BY created_at DESC LIMIT 30`,
        args: [userId],
      });
      questions = qRes.rows.map((r) => ({
        id: Number(r.id),
        question: String(r.question),
        starred: Boolean(r.starred),
        chosen: Boolean(r.chosen_for_seminar),
      }));
      notifications = await unreadFor(userId, 10);
      const rolesRes = await db().execute({
        sql: `SELECT pr.product_key, pr.role, p.title FROM product_roles pr
              JOIN products p ON p.key = pr.product_key WHERE pr.user_id = ?`,
        args: [userId],
      });
      roles = rolesRes.rows.map((r) => ({
        productKey: String(r.product_key),
        title: String(r.title),
        role: String(r.role),
      }));
      const refRes = await db().execute({
        sql: `SELECT context_ref, difficulty, pshat_progress, argument_progress, note, created_at
              FROM reflections WHERE user_id = ? ORDER BY created_at ASC`,
        args: [userId],
      });
      reflections = refRes.rows.map((r) => ({
        createdAt: Number(r.created_at),
        difficulty: Number(r.difficulty),
        pshat: Number(r.pshat_progress),
        argument: Number(r.argument_progress),
        contextRef: (r.context_ref as string | null) ?? null,
        note: (r.note as string | null) ?? null,
      }));
      await markAllRead(userId);
    }
  } catch {
    // DB not available
  }

  const overdue = tasks.filter((t) => t.status === "overdue");
  const current =
    tasks.find((t) => t.status === "in_progress") ??
    tasks.find((t) => t.status === "not_started");
  const done = tasks.filter((t) => t.status === "graded" || t.status === "submitted").length;
  const totalWork = tasks.reduce((s, t) => s + t.workSeconds, 0);
  const avg = (() => {
    const scored = tasks.filter((t) => t.score != null);
    if (scored.length === 0) return null;
    return Math.round(scored.reduce((s, t) => s + (t.score ?? 0), 0) / scored.length);
  })();

  return (
    <>
      <TopNav />
      {!user.guest && <ReflectionDrawer contextRef="העמוד האישי" />}
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        {/* hero */}
        <div className="mb-8 text-center">
          <div className="mb-5 flex items-center justify-center gap-3" aria-hidden>
            <div className="h-px w-12 bg-[color:var(--accent)]/60" />
            <div className="h-1.5 w-1.5 rotate-45 bg-[color:var(--accent)]" />
            <div className="h-px w-12 bg-[color:var(--accent)]/60" />
          </div>
          <h1 className="font-display text-4xl font-extrabold text-[color:var(--primary)] sm:text-5xl">
            שלום, {name}
          </h1>
          <p className="mt-2 text-sm text-[color:var(--foreground)]/60">
            תורה ונביאים לבגרות · כיתה י · תיכון שחרית
          </p>
        </div>

        {/* overdue alert */}
        {overdue.length > 0 && (
          <div className="mb-6 rounded-2xl border-2 border-[color:var(--danger)]/50 bg-[color:var(--danger)]/10 p-4">
            <p className="font-bold text-[color:var(--danger)]">
              ⏰ שימו לב! {overdue.length === 1 ? "משימה אחת עברה" : `${overdue.length} משימות עברו`} את מועד ההגשה:
            </p>
            <ul className="mt-2 space-y-1">
              {overdue.map((t) => (
                <li key={t.id}>
                  <Link
                    href={`/tasks/${t.id}`}
                    className="text-sm font-semibold text-[color:var(--danger)] underline-offset-2 hover:underline"
                  >
                    {t.title} — היה להגשה עד {formatHebDate(t.dueAt)} ←
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* stat tiles */}
        <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile emoji="📚" value={`${done}/${tasks.length || 0}`} label="משימות הושלמו" />
          <StatTile emoji="⏱" value={totalWork > 0 ? formatWorkTime(totalWork) : "—"} label="זמן למידה בפועל" />
          <StatTile emoji="❓" value={String(questions.length)} label="שאלות במאגר שלי" />
          <StatTile emoji="🏅" value={avg != null ? String(avg) : "—"} label="ממוצע ציונים" />
        </div>

        {/* current task */}
        {current && (
          <Link
            href={`/tasks/${current.id}`}
            className="group mb-8 block rounded-2xl border-2 border-[color:var(--accent)]/50 bg-[color:var(--card)] p-6 shadow-sm transition hover:shadow-md"
          >
            <p className="mb-1 text-[11px] font-bold tracking-[0.2em] text-[color:var(--accent)]">
              ✨ במה אני עכשיו
            </p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">
                  {current.title}
                </h2>
                <p className="mt-1 text-xs text-[color:var(--primary)]/60">
                  📅 להגשה עד {formatHebDate(current.dueAt)} · שלב {current.stage}/8
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-28 overflow-hidden rounded-full bg-[color:var(--border)]/50">
                  <div
                    className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)]"
                    style={{ width: `${current.progressPct}%` }}
                  />
                </div>
                <span className="font-display text-lg font-bold text-[color:var(--primary)]">
                  {current.progressPct}%
                </span>
                <span aria-hidden className="text-xl text-[color:var(--accent)] transition group-hover:-translate-x-1">
                  ←
                </span>
              </div>
            </div>
          </Link>
        )}

        {/* learning journey */}
        <section className="mb-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="mb-5 font-display text-lg font-bold text-[color:var(--primary)]">
            🗺️ מסע הלמידה שלי
          </h2>
          {tasks.length === 0 ? (
            <p className="text-sm text-[color:var(--foreground)]/55">
              המסע יתחיל כשהמורה תפרסם את המשימה הראשונה 🌱
            </p>
          ) : (
            <ol className="relative space-y-0 border-e-2 border-[color:var(--border)] pe-6">
              {tasks.map((t) => {
                const meta = STATUS_META[t.status];
                const doneStep = t.status === "graded" || t.status === "submitted";
                return (
                  <li key={t.id} className="relative pb-8 last:pb-0">
                    <span
                      className="absolute -end-[31px] top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 text-base"
                      style={{
                        background: doneStep ? meta.bg : "var(--card)",
                        borderColor: meta.color,
                      }}
                    >
                      {t.status === "graded"
                        ? "🏅"
                        : t.status === "submitted"
                          ? "📬"
                          : t.status === "in_progress"
                            ? "✏️"
                            : t.status === "overdue"
                              ? "⏰"
                              : "📖"}
                    </span>
                    <div className="me-2">
                      <Link
                        href={`/tasks/${t.id}`}
                        className="font-semibold text-[color:var(--primary)] underline-offset-2 hover:underline"
                      >
                        {t.title}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[color:var(--primary)]/55">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.label}
                        </span>
                        <span>📅 {formatHebDate(t.dueAt)}</span>
                        {t.score != null && <b className="text-[color:var(--success)]">ציון: {t.score}</b>}
                      </p>
                      {t.feedback && (
                        <p className="mt-1 rounded-lg bg-[color:var(--success)]/10 px-3 py-1.5 text-xs leading-5 text-[color:var(--foreground)]/75">
                          💬 {t.feedback}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <div className="grid gap-6 sm:grid-cols-2">
          {/* question bank */}
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
              ❓ מאגר השאלות שלי
            </h2>
            <QuestionBank initial={questions} />
          </section>

          {/* products + roles */}
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
            <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
              🎨 התוצרים שלי
            </h2>
            <ul className="space-y-2 text-xs leading-6">
              <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                <b>תוצר א</b> — נייר עמדה · מחצית א
                {roleFor(roles, "product-a")}
              </li>
              <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                <b>תוצר ב</b> — עבודת חקר + תערוכה · מחצית ב
                {roleFor(roles, "product-b")}
              </li>
              <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                <b>מיני-סמינריון</b> — שאלה אחת ממאגר השאלות שלי
              </li>
            </ul>
            {isTeacher && (
              <p className="mt-2 text-[10px] text-[color:var(--primary)]/45">
                (חלוקת תפקידים תוגדר בדשבורד בהמשך)
              </p>
            )}
          </section>
        </div>

        {/* reflections archive + trend graph */}
        <section className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            🪞 הרפלקציות שלי {reflections.length > 0 && `(${reflections.length})`}
          </h2>
          {reflections.length === 0 ? (
            <p className="text-xs leading-6 text-[color:var(--foreground)]/55">
              בסוף כל שיעור (או בכל רגע, דרך לשונית הרפלקציה בצד) תוכלי לספר
              איך היה — והגרף שלך יצמח כאן 🌱
            </p>
          ) : (
            <>
              {reflections.length >= 2 && <ReflectionGraph points={reflections} />}
              <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {[...reflections].reverse().map((r, i) => (
                  <li key={i} className="rounded-xl bg-[color:var(--background)] px-4 py-2.5 text-xs leading-6">
                    <p className="text-[10px] text-[color:var(--primary)]/50">
                      {new Intl.DateTimeFormat("he-IL", {
                        weekday: "long",
                        day: "numeric",
                        month: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(r.createdAt * 1000))}
                      {r.contextRef && ` · ${r.contextRef}`}
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
            </>
          )}
        </section>

        {/* notifications */}
        <section id="notifications" className="mt-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="mb-3 font-display text-base font-bold text-[color:var(--primary)]">
            🔔 התראות אחרונות
          </h2>
          {notifications.length === 0 ? (
            <p className="text-xs text-[color:var(--foreground)]/55">אין התראות עדיין.</p>
          ) : (
            <ul className="space-y-1.5">
              {notifications.map((n) => (
                <li key={n.id} className={n.read ? "opacity-60" : ""}>
                  {n.link ? (
                    <Link
                      href={n.link}
                      className="block rounded-lg bg-[color:var(--primary)]/5 px-3 py-2 text-xs leading-5 transition hover:bg-[color:var(--primary)]/10"
                    >
                      <b>{n.title}</b>
                      {n.body && <span className="block text-[color:var(--foreground)]/65">{n.body}</span>}
                    </Link>
                  ) : (
                    <div className="rounded-lg bg-[color:var(--primary)]/5 px-3 py-2 text-xs leading-5">
                      <b>{n.title}</b>
                      {n.body && <span className="block text-[color:var(--foreground)]/65">{n.body}</span>}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}

function roleFor(
  roles: { productKey: string; role: string }[],
  key: string
) {
  const r = roles.find((x) => x.productKey === key);
  if (!r) return null;
  return (
    <span className="ms-2 rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent)]">
      התפקיד שלי: {r.role}
    </span>
  );
}

function StatTile({ emoji, value, label }: { emoji: string; value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-center">
      <p className="text-xl">{emoji}</p>
      <p className="font-display text-xl font-extrabold text-[color:var(--primary)]">{value}</p>
      <p className="text-[11px] text-[color:var(--primary)]/60">{label}</p>
    </div>
  );
}
