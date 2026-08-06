import Link from "next/link";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth, signOut } from "@/auth";
import { getUnreadCount } from "@/lib/notifications";
import { isStudentMode, STUDENT_MODE_COOKIE } from "@/lib/student-mode";
import MobileNav from "./mobile-nav";

// =============================================================================
// Top navigation. Renders BOTH a desktop inline nav (visible at xl+) and a
// hamburger + drawer (visible below xl). With 11 links we never try to fit
// them inline on narrow screens.
// =============================================================================
export default async function TopNav() {
  const session = await auth();
  const user = session?.user;
  const realTeacher = user?.role === "teacher";
  const studentMode = realTeacher && (await isStudentMode());
  // In student mode the whole UI behaves as if the teacher were a student.
  const isTeacher = realTeacher && !studentMode;
  const userId = user?.id ? Number(user.id) : null;
  const unread = userId ? await getUnreadCount(userId) : 0;

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }
  async function enterStudentMode() {
    "use server";
    (await cookies()).set(STUDENT_MODE_COOKIE, "1", {
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    revalidatePath("/", "layout");
  }
  async function exitStudentMode() {
    "use server";
    (await cookies()).delete(STUDENT_MODE_COOKIE);
    revalidatePath("/", "layout");
  }

  const links = [
    { href: "/", label: "דף הבית" },
    { href: "/me", label: "עמוד אישי" },
    { href: "/program", label: "התוכנית ולו\"ז" },
    { href: "/tasks", label: "משימות שוטפות" },
    { href: "/exams", label: "הכנות למבחנים" },
    { href: "/writing", label: "תרגול כתיבה טיעונית" },
    { href: "/debate", label: "הדיבייט" },
    { href: "/product-a", label: "תוצר א" },
    { href: "/product-b", label: "תוצר ב" },
    { href: "/messages", label: "קשר" },
  ];
  if (isTeacher) {
    links.push({ href: "/dashboard", label: "דשבורד מורה" });
  }

  const userLabel = user
    ? `שלום, ${user.fullName ?? user.name ?? user.email}`
    : "";

  return (
    <header
      className="pwa-safe-top sticky top-0 z-30 border-b border-[color:var(--border)] backdrop-blur"
      style={{ backgroundColor: "var(--card)" }}
    >
      {studentMode && (
        <div className="flex items-center justify-center gap-3 bg-[color:var(--warning)] px-4 py-1.5 text-center text-xs font-bold text-white">
          <span>👩‍🎓 מצב תלמיד פעיל — את/ה חווה את האתר בדיוק כמו תלמיד/ה</span>
          <form action={exitStudentMode}>
            <button
              type="submit"
              className="rounded-full bg-white/20 px-3 py-0.5 text-[11px] font-bold hover:bg-white/30"
            >
              חזרה למצב מורה
            </button>
          </form>
        </div>
      )}
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <Link
          href="/"
          className="font-display shrink-0 text-base font-extrabold tracking-tight text-[color:var(--primary)] sm:text-lg"
        >
          בינת התורה
        </Link>

        {/* Desktop inline links (xl+) */}
        <nav className="hidden flex-1 items-center justify-center gap-0.5 xl:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[13px] text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/5"
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* Left cluster (RTL) — bell always visible; user greeting +
            sign-out only on xl+; hamburger only below xl. */}
        <div className="flex items-center gap-2 sm:gap-3">
          {user && (
            <Link
              href="/me#notifications"
              aria-label={
                unread > 0 ? `התראות — ${unread} חדשות` : "התראות"
              }
              className="relative rounded-full p-2 text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/5"
            >
              <span
                className={
                  unread > 0 ? "inline-block bell-ring" : "inline-block"
                }
              >
                <BellIcon />
              </span>
              {unread > 0 && (
                <span className="absolute -top-0.5 -left-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--danger)] px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Desktop only */}
          {user && (
            <span className="hidden whitespace-nowrap text-xs text-[color:var(--primary)]/70 xl:inline">
              {userLabel}
              {isTeacher && (
                <span className="ms-2 rounded-full bg-[color:var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">
                  מורה
                </span>
              )}
            </span>
          )}
          {isTeacher && (
            <form action={enterStudentMode} className="hidden xl:block">
              <button
                type="submit"
                title="חוויית האתר בדיוק כפי שתלמידה רואה אותו — כולל ביצוע משימות"
                className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
              >
                👩‍🎓 מצב תלמיד
              </button>
            </form>
          )}
          <form action={handleSignOut} className="hidden xl:block">
            <button
              type="submit"
              className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 text-xs text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
            >
              יציאה
            </button>
          </form>

          {/* Mobile only */}
          {user && (
            <div className="xl:hidden">
              <MobileNav
                links={links}
                userLabel={userLabel}
                isTeacher={isTeacher}
                signOutAction={handleSignOut}
              />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}
