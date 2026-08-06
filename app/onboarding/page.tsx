import { auth, updateSession } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.onboarded) redirect("/");

  async function completeOnboarding(formData: FormData) {
    "use server";
    const fullName = String(formData.get("fullName") ?? "").trim();
    const addressForm = String(formData.get("addressForm") ?? "neutral");
    const valid = ["f", "m", "neutral"].includes(addressForm) ? addressForm : "neutral";
    if (!fullName) return;
    const session = await auth();
    if (!session?.user?.id) return;
    const userId = Number(session.user.id);
    const now = Math.floor(Date.now() / 1000);
    await db().execute({
      sql: "UPDATE users SET full_name = ?, address_form = ?, onboarded_at = ? WHERE id = ?",
      args: [fullName, valid, now, userId],
    });
    // Explicitly refresh the JWT cookie so the app sees onboarded=true
    // on the next request (without this we'd get a redirect loop).
    await updateSession({
      user: { onboarded: true, fullName, addressForm: valid },
    });
    redirect("/");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-8 shadow-sm">
        <h1 className="font-display text-center text-2xl font-bold text-[color:var(--primary)]">
          ברוכים הבאים לבינת התורה!
        </h1>
        <p className="mt-2 text-center text-sm text-[color:var(--primary)]/70">
          איך קוראים לך? השם המלא בעברית הוא שיופיע בעמוד האישי, בהאדר
          ובדשבורד המורה.
        </p>

        <form action={completeOnboarding} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="fullName"
              className="mb-1 block text-sm font-medium text-[color:var(--primary)]"
            >
              שם מלא בעברית
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              placeholder="לדוגמה: שרה כהן"
              className="w-full rounded-lg border border-[color:var(--border)] bg-white px-4 py-2 text-right outline-none transition focus:border-[color:var(--accent)]"
            />
          </div>

          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-[color:var(--primary)]">
              איך לפנות אליך באתר? (גם קלוד, העוזר החכם, יכתוב כך)
            </legend>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: "f", label: "לשון נקבה", example: "נסי, קראי" },
                { value: "m", label: "לשון זכר", example: "נסה, קרא" },
                { value: "neutral", label: "ניטרלי", example: "נסו, קראו" },
              ].map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer flex-col items-center gap-0.5 rounded-xl border border-[color:var(--border)] px-2 py-2.5 text-center transition has-[:checked]:border-[color:var(--primary)] has-[:checked]:bg-[color:var(--primary)]/8"
                >
                  <input
                    type="radio"
                    name="addressForm"
                    value={o.value}
                    defaultChecked={o.value === "neutral"}
                    className="sr-only"
                  />
                  <span className="text-sm font-semibold text-[color:var(--primary)]">
                    {o.label}
                  </span>
                  <span className="text-[10px] text-[color:var(--primary)]/55">
                    {o.example}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <button
            type="submit"
            className="w-full rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:opacity-90"
          >
            המשך לאתר
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[color:var(--primary)]/60">
          המידע נשמר רק לצורכי הלימוד והמורה, ולא נחשף לאחרים.
        </p>
      </div>
    </main>
  );
}
