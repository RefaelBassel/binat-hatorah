import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import PageShell from "@/components/page-shell";
import { db } from "@/lib/db";
import { allDebates, DEBATE_STAGES, VOTE_AXES, now } from "@/lib/debate";
import { isStudentMode } from "@/lib/student-mode";

export default async function DebatePage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  const isTeacher =
    user.role === "teacher" && !(await isStudentMode()) && !user.guest;

  let debates: Awaited<ReturnType<typeof allDebates>> = [];
  try {
    debates = await allDebates();
  } catch {
    // DB unavailable
  }

  async function createDebate(formData: FormData) {
    "use server";
    const session = await auth();
    if (session?.user?.role !== "teacher" || session.user.guest) return;
    const title = String(formData.get("title") ?? "").trim();
    if (!title) return;
    const t = now();
    const res = await db().execute({
      sql: "INSERT INTO debates (title, status, created_by, created_at) VALUES (?, 'draft', ?, ?)",
      args: [title, Number(session.user.id), t],
    });
    const debateId = Number(res.lastInsertRowid);
    for (let i = 1; i <= 3; i++) {
      const question = String(formData.get(`q${i}`) ?? "").trim();
      if (!question) continue;
      await db().execute({
        sql: `INSERT INTO debate_questions
                (debate_id, order_idx, question, position_a, position_b, group_a, group_b)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          debateId,
          i,
          question,
          String(formData.get(`q${i}a`) ?? "בעד").trim() || "בעד",
          String(formData.get(`q${i}b`) ?? "נגד").trim() || "נגד",
          String(formData.get(`q${i}ga`) ?? `קבוצה א׳`).trim() || "קבוצה א׳",
          String(formData.get(`q${i}gb`) ?? `קבוצה ב׳`).trim() || "קבוצה ב׳",
        ],
      });
    }
    revalidatePath("/debate");
  }

  return (
    <PageShell
      title="הדיבייט"
      subtitle="מתווכחים בשפת הטיעון: טענות, הנחות יסוד, נימוקים ומסקנות — ענייני, זורם, ובלי טקסים"
    >
      <div className="mx-auto max-w-4xl space-y-10">
        {/* how it works — the approved format */}
        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
          <h2 className="mb-4 font-display text-lg font-bold text-[color:var(--primary)]">
            🎙️ איך זה עובד? (~25 דקות לכל שאלה)
          </h2>
          <ol className="grid gap-2 sm:grid-cols-3">
            {DEBATE_STAGES.map((s, i) => (
              <li
                key={s.key}
                className="rounded-xl bg-[color:var(--background)] px-3 py-2 text-xs leading-5"
              >
                <b className="text-[color:var(--primary)]">
                  {i + 1}. {s.title}
                  {s.side === "a" && " · קבוצה א׳"}
                  {s.side === "b" && " · קבוצה ב׳"}
                </b>
                <span className="block text-[color:var(--foreground)]/65">
                  {Math.round(s.seconds / 60)}
                  {s.seconds % 60 === 30 ? ".5" : ""} דק׳ — {s.hint}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-xl bg-[color:var(--accent)]/10 p-4">
            <p className="text-xs font-bold text-[color:var(--accent)]">
              🗳️ ההצבעה היא בשפת המיומנות — הקהל מדרג כל קבוצה על 4 צירים:
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {VOTE_AXES.map((a) => (
                <span
                  key={a.key}
                  className="rounded-full bg-[color:var(--card)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--primary)]"
                >
                  {a.label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* debates list */}
        <section>
          <h2 className="mb-4 font-display text-lg font-bold text-[color:var(--primary)]">
            📋 הדיבייטים
          </h2>
          {debates.length === 0 ? (
            <p className="text-sm text-[color:var(--foreground)]/60">
              עדיין לא נוצרו דיבייטים. {isTeacher && "צרי את הראשון למטה!"}
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {debates.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span
                      className={[
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold",
                        d.status === "live"
                          ? "bg-[color:var(--danger)]/15 text-[color:var(--danger)]"
                          : d.status === "done"
                            ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
                            : "bg-[color:var(--border)]/60 text-[color:var(--primary)]/60",
                      ].join(" ")}
                    >
                      {d.status === "live" ? "🔴 לייב עכשיו" : d.status === "done" ? "הסתיים" : "בהכנה"}
                    </span>
                    <span className="text-[11px] text-[color:var(--primary)]/50">
                      {d.questions} שאלות
                    </span>
                  </div>
                  <h3 className="font-display text-base font-bold text-[color:var(--primary)]">
                    {d.title}
                  </h3>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                    {d.status === "live" && (
                      <Link
                        href={`/debate/${d.id}/vote`}
                        className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-white"
                      >
                        🗳️ להצבעה
                      </Link>
                    )}
                    {(d.status === "live" || d.status === "done") && (
                      <Link
                        href={`/debate/${d.id}/results`}
                        className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[color:var(--primary)]"
                      >
                        🏆 תוצאות
                      </Link>
                    )}
                    {isTeacher && (
                      <>
                        <Link
                          href={`/debate/live/${d.id}`}
                          className="rounded-full border border-[color:var(--accent)] px-4 py-1.5 text-[color:var(--accent)]"
                        >
                          📽️ מסך הלוח
                        </Link>
                        <Link
                          href={`/debate/control/${d.id}`}
                          className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-[color:var(--primary)]"
                        >
                          🎛️ שלט המורה
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* teacher: create debate */}
        {isTeacher && (
          <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            <h2 className="mb-1 font-display text-lg font-bold text-[color:var(--primary)]">
              ➕ יצירת דיבייט חדש
            </h2>
            <p className="mb-4 text-xs text-[color:var(--foreground)]/60">
              עד 3 שאלות. לכל שאלה: שתי העמדות שבעימות ושמות הקבוצות.
            </p>
            <form action={createDebate} className="space-y-5">
              <input
                name="title"
                required
                placeholder="כותרת הדיבייט (למשל: דיבייט אחריות קהילתית — במדבר)"
                className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
              />
              {[1, 2, 3].map((i) => (
                <fieldset
                  key={i}
                  className="rounded-xl border border-dashed border-[color:var(--border)] p-4"
                >
                  <legend className="px-2 text-xs font-bold text-[color:var(--primary)]/60">
                    שאלה {i} {i > 1 && "(לא חובה)"}
                  </legend>
                  <input
                    name={`q${i}`}
                    required={i === 1}
                    placeholder="השאלה שבמחלוקת (למשל: האם משה צדק כשעצר את המסע בגלל מרים?)"
                    className="mb-2 w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input name={`q${i}ga`} placeholder="שם קבוצה א׳" className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm" />
                    <input name={`q${i}gb`} placeholder="שם קבוצה ב׳" className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm" />
                    <input name={`q${i}a`} placeholder="עמדת קבוצה א׳" className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm" />
                    <input name={`q${i}b`} placeholder="עמדת קבוצה ב׳" className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm" />
                  </div>
                </fieldset>
              ))}
              <button
                type="submit"
                className="rounded-full bg-[color:var(--primary)] px-8 py-2.5 text-sm font-bold text-white shadow"
              >
                יצירת הדיבייט
              </button>
            </form>
          </section>
        )}
      </div>
    </PageShell>
  );
}
