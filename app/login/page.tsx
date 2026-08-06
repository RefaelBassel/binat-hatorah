import { signIn, auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect(session.user.onboarded ? "/" : "/onboarding");
  }

  async function signInWithGoogle() {
    "use server";
    await signIn("google", { redirectTo: "/" });
  }
  async function enterAsStudentGuest() {
    "use server";
    await signIn("guest", { mode: "student", redirectTo: "/me" });
  }
  async function enterAsFullGuest() {
    "use server";
    await signIn("guest", { mode: "full", redirectTo: "/dashboard" });
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 shadow-sm">
        <h1 className="font-display text-center text-3xl font-bold text-[color:var(--primary)]">
          בינת התורה
        </h1>
        <p className="mt-2 text-center text-sm text-[color:var(--primary)]/70">
          תורה ונביאים לבגרות בכיתה י, תיכון שחרית
        </p>

        <div className="mt-8 space-y-3">
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-[color:var(--primary)] px-5 py-3 text-sm font-semibold text-white shadow transition hover:opacity-90"
            >
              <GoogleIcon />
              כניסה עם חשבון Google
            </button>
          </form>
          <p className="text-center text-[11px] text-[color:var(--primary)]/55">
            חשבון גוגל פרטי או של משרד החינוך
          </p>

          <div className="flex items-center gap-3 py-2" aria-hidden>
            <div className="h-px flex-1 bg-[color:var(--border)]" />
            <span className="text-[11px] text-[color:var(--primary)]/45">
              או צפייה בלבד
            </span>
            <div className="h-px flex-1 bg-[color:var(--border)]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <form action={enterAsStudentGuest}>
              <button
                type="submit"
                className="w-full rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
              >
                אורחת — תצוגת תלמידה
              </button>
            </form>
            <form action={enterAsFullGuest}>
              <button
                type="submit"
                className="w-full rounded-xl border border-[color:var(--border)] px-4 py-2.5 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
              >
                אורחת — גישה מלאה
              </button>
            </form>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-[color:var(--primary)]/60">
          בכניסה הראשונה נבקש ממך להזין שם מלא בעברית — הוא שיופיע באתר
          ובדשבורד המורה.
        </p>

        {process.env.NODE_ENV !== "production" && <DevLogin />}
      </div>
    </main>
  );
}

// Local-development login (no Google needed). Not rendered in production.
function DevLogin() {
  async function devSignIn(formData: FormData) {
    "use server";
    await signIn("dev", {
      email: String(formData.get("email") ?? ""),
      name: String(formData.get("name") ?? ""),
      redirectTo: "/",
    });
  }
  return (
    <form
      action={devSignIn}
      className="mt-6 space-y-2 rounded-xl border border-dashed border-[color:var(--warning)]/60 bg-[color:var(--warning)]/5 p-4"
    >
      <p className="text-[11px] font-bold text-[color:var(--warning)]">
        🛠 כניסת פיתוח (מקומי בלבד)
      </p>
      <input
        name="email"
        type="email"
        required
        placeholder="student@test.local"
        className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs"
      />
      <input
        name="name"
        type="text"
        placeholder="שם מלא (לדוגמה: שרה כהן)"
        className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-1.5 text-xs"
      />
      <button
        type="submit"
        className="w-full rounded-lg bg-[color:var(--warning)] px-3 py-1.5 text-xs font-bold text-white"
      >
        כניסת פיתוח
      </button>
    </form>
  );
}

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
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
