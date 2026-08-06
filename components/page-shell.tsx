import TopNav from "./top-nav";
import ReflectionDrawer from "./reflection-drawer";
import ContinueFab from "./continue-fab";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

// Shared wrapper for inner pages: top nav + centered content column with a
// consistent page header + the reflection side drawer (available everywhere —
// a lesson doesn't always end when a task ends). Section pages whose full
// spec arrives later render a "בבנייה" placeholder body through this shell.
export default async function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const session = await auth();
  // Onboarding enforcement lives here (middleware is auth-library-free):
  // an authed-but-not-onboarded user is sent to enter her Hebrew name first.
  if (session?.user && !session.user.guest && !session.user.onboarded) {
    redirect("/onboarding");
  }
  const showDrawer = Boolean(session?.user) && !session?.user?.guest;
  return (
    <>
      <TopNav />
      {showDrawer && <ReflectionDrawer contextRef={title} />}
      {showDrawer && <ContinueFab />}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex items-center gap-3" aria-hidden>
            <div className="h-px w-12 bg-[color:var(--accent)]/60" />
            <div className="h-1.5 w-1.5 rotate-45 bg-[color:var(--accent)]" />
            <div className="h-px w-12 bg-[color:var(--accent)]/60" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-[color:var(--primary)] sm:text-4xl">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--foreground)]/70 sm:text-base">
              {subtitle}
            </p>
          )}
        </div>
        {children}
      </main>
    </>
  );
}

export function ComingSoon({ note }: { note?: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)]/70 px-8 py-12 text-center">
      <p className="font-display text-lg font-bold text-[color:var(--primary)]">
        העמוד בבנייה
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]/65">
        {note ?? "התכנים לעמוד זה יעלו בקרוב."}
      </p>
    </div>
  );
}
