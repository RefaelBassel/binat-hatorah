import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";

// The only page an unapproved (or blocked) account can see. The proxy sends
// every other request here until a teacher approves the account in
// /dashboard/students; the JWT re-checks on each request, so the next click
// after approval simply works.
export default async function PendingPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role === "teacher" || user.approved) redirect("/");

  async function leave() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const blocked = Boolean(user.blocked);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 text-center shadow-sm">
        <div aria-hidden className="mb-3 text-5xl">
          {blocked ? "🔒" : "⏳"}
        </div>
        <h1 className="font-display text-2xl font-extrabold text-[color:var(--primary)]">
          {blocked ? "החשבון הזה אינו פעיל" : "החשבון ממתין לאישור המורה"}
        </h1>
        <p className="mt-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          {blocked
            ? "הכניסה לאתר נחסמה על ידי המורה. אם זו טעות — דברו עם ריעות בכיתה."
            : "נכנסת עם החשבון " +
              (user.email ?? "") +
              ". כדי לשמור על האתר לכיתה בלבד, המורה מאשרת כל חשבון חדש. ברגע שהיא תאשר — פשוט לרענן, או להיכנס שוב."}
        </p>
        <form action={leave} className="mt-6">
          <button
            type="submit"
            className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
          >
            יציאה והחלפת חשבון
          </button>
        </form>
      </div>
    </main>
  );
}
