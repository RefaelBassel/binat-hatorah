import Link from "next/link";
import { auth, signIn } from "@/auth";
import TopNav from "@/components/top-nav";
import { continueTask } from "@/lib/tasks";

// Landing page (/) — open to everyone. Signed-out visitors see the hero with
// a Google sign-in button; signed-in visitors see the TopNav, a prominent
// link to the personal page, a "המשך משימות" button, and the section cards.
export default async function HomePage() {
  const session = await auth();
  const isAuthed = Boolean(session?.user);

  // "המשך משימות" — resume exactly where the student stopped.
  let continueHref = "/tasks";
  if (isAuthed && !session?.user?.guest) {
    try {
      const { isStudentMode } = await import("@/lib/student-mode");
      const teacherAsStudent =
        session?.user?.role === "teacher" && (await isStudentMode());
      if (session?.user?.role === "student" || teacherAsStudent) {
        const next = await continueTask(Number(session!.user!.id), teacherAsStudent);
        if (next) continueHref = `/tasks/${next.id}`;
      }
    } catch {
      // DB unavailable — plain /tasks link
    }
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }

  return (
    <>
      {isAuthed && <TopNav />}
      <main className="relative flex flex-1 flex-col">
        <Backdrop />

        <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 py-16 sm:py-24">
          <ScribalRule />

          <p className="mb-6 text-[11px] font-semibold tracking-[0.4em] text-[color:var(--accent)]">
            תורה · נביאים · כיתה י · תיכון שחרית
          </p>

          <h1 className="font-display text-center text-7xl font-extrabold leading-[0.95] tracking-[-0.03em] text-[color:var(--primary)] sm:text-[110px]">
            בינת התורה
          </h1>

          <p className="mt-10 max-w-2xl text-center text-lg leading-relaxed text-[color:var(--foreground)]/85 sm:text-xl">
            תורה ונביאים לבגרות בכיתה י, תיכון שחרית.
          </p>
          <p className="mt-4 max-w-2xl text-center text-sm leading-relaxed text-[color:var(--foreground)]/65 sm:text-base">
            בדגש על מיומנויות לימוד עצמי של פשט התורה (שאלת שאלות, זיהוי מילה
            מנחה, תקבולות, מילים קשות וכיוצ״ב) וכתיבה טיעונית.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row">
            {isAuthed ? (
              <>
                <Link
                  href="/me"
                  className="group flex items-center gap-3 rounded-full bg-[color:var(--primary)] px-8 py-4 text-base font-semibold text-[color:var(--background)] shadow-lg shadow-black/10 transition hover:scale-[1.02] hover:shadow-xl active:scale-100"
                >
                  <span>לעמוד האישי שלי</span>
                  <span aria-hidden className="transition group-hover:-translate-x-0.5">
                    ←
                  </span>
                </Link>
                <Link
                  href={continueHref}
                  className="group flex items-center gap-3 rounded-full border-2 border-[color:var(--accent)] px-8 py-3.5 text-base font-semibold text-[color:var(--accent)] transition hover:bg-[color:var(--accent)]/10"
                >
                  <span>המשך משימות</span>
                  <span aria-hidden className="transition group-hover:-translate-x-0.5">
                    ←
                  </span>
                </Link>
              </>
            ) : (
              <div className="flex flex-col items-center">
                <form action={signInWithGoogle}>
                  <button
                    type="submit"
                    className="group flex items-center gap-3 rounded-full bg-[color:var(--primary)] px-8 py-4 text-base font-semibold text-[color:var(--background)] shadow-lg shadow-black/10 transition hover:scale-[1.02] hover:shadow-xl active:scale-100"
                  >
                    <GoogleIcon />
                    <span>כניסה עם חשבון Google</span>
                    <span aria-hidden className="transition group-hover:-translate-x-0.5">
                      ←
                    </span>
                  </button>
                </form>
                <p className="mt-4 text-center text-xs text-[color:var(--primary)]/60">
                  אפשר להתחבר עם חשבון גוגל פרטי או של משרד החינוך. בכניסה
                  הראשונה נבקש להזין שם מלא בעברית.
                </p>
              </div>
            )}
          </div>

          {isAuthed && <SectionCards />}

          <FeatureStrip />
        </div>
      </main>
    </>
  );
}

// =============================================================================
// Sub-components
// =============================================================================

function Backdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(circle at 18% 12%, rgba(185, 106, 59, 0.09) 0%, transparent 38%), radial-gradient(circle at 82% 88%, rgba(65, 48, 85, 0.07) 0%, transparent 50%)",
      }}
    />
  );
}

function ScribalRule() {
  // Manuscript-style divider: thin copper rule with center diamond.
  return (
    <div className="mb-8 flex items-center gap-3" aria-hidden>
      <div className="h-px w-16 bg-[color:var(--accent)]/60" />
      <div className="h-1.5 w-1.5 rotate-45 bg-[color:var(--accent)]" />
      <div className="h-px w-16 bg-[color:var(--accent)]/60" />
    </div>
  );
}

function SectionCards() {
  const cards = [
    {
      href: "/program",
      title: "התוכנית ולו״ז",
      body: "המטרות, המיומנויות, הפרקים והמפרשים, התפלגות הציון ולוח הזמנים.",
    },
    {
      href: "/tasks",
      title: "משימות שוטפות",
      body: "משימות הלמידה שהוקצו לך — מה בלימוד עכשיו, מה הוגש ומה ממתין.",
    },
    {
      href: "/exams",
      title: "הכנות למבחנים",
      body: "תרגולים וחזרות לקראת מבחן א ומבחן ב.",
    },
    {
      href: "/writing",
      title: "תרגול כתיבה טיעונית",
      body: "תרגולים ברמות שונות עם סיוע מותאם אישית.",
    },
    {
      href: "/debate",
      title: "הדיבייט",
      body: "ההכנה, הדיבייט לייב, והעיבוד שאחריו.",
    },
    {
      href: "/messages",
      title: "קשר",
      body: "שיח אישי וקבוצתי עם המורה.",
    },
  ];
  return (
    <section className="mt-20 w-full">
      <p className="mb-5 text-center text-[10px] font-semibold tracking-[0.3em] text-[color:var(--accent)]">
        אזורי הלמידה
      </p>
      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 shadow-sm transition hover:border-[color:var(--accent)]/50 hover:shadow-md"
          >
            <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">
              {c.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/70">
              {c.body}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--accent)]">
              <span>כניסה</span>
              <span aria-hidden className="transition group-hover:-translate-x-0.5">
                ←
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function FeatureStrip() {
  const features = [
    {
      title: "לימוד עצמי",
      body: "שאלת שאלות, מילה מנחה, תקבולות ומילים קשות — כלים לקריאת פשט עצמאית.",
    },
    {
      title: "כתיבה טיעונית",
      body: "תרגול מדורג של טענה, נימוק וביסוס מן הכתובים.",
    },
    {
      title: "ליווי אישי",
      body: "מעקב התקדמות, משוב על כל הגשה, וקשר ישיר עם המורה.",
    },
  ];
  return (
    <div className="mt-24 grid w-full grid-cols-1 gap-6 sm:grid-cols-3">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/70 p-6 backdrop-blur-sm"
        >
          <h3 className="font-display text-lg font-bold text-[color:var(--primary)]">
            {f.title}
          </h3>
          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/70">
            {f.body}
          </p>
        </div>
      ))}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
