import { formatHebDate } from "@/lib/hebrew";
import { fmtMinutes } from "@/lib/practice-types";
import type { MissedQuestion, StudentPracticeRow } from "@/lib/practice";

// Teacher: who practiced, for how long and in which units, and the quiz
// questions the class misses most (issue #34). Not part of the grades report.
export default function PracticeStats({ students, missed }: { students: StudentPracticeRow[]; missed: MissedQuestion[] }) {
  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
      <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">📊 מי תרגלה</h2>
      <p className="mb-3 text-xs text-[color:var(--foreground)]/65">לא נכנס לדוח הציונים.</p>
      {students.length === 0 ? (
        <p className="text-sm">עדיין אף תלמידה לא תרגלה.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-right text-sm">
            <thead>
              <tr className="border-b border-[color:var(--border)] text-xs text-[color:var(--primary)]">
                <th className="p-2">תלמידה</th>
                <th className="p-2">זמן תרגול</th>
                <th className="p-2">פעולות</th>
                <th className="p-2">חידון</th>
                <th className="p-2">יחידות</th>
                <th className="p-2">לאחרונה</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.userId} className="border-b border-[color:var(--border)]/60 align-top">
                  <td className="p-2 font-semibold">{s.name}</td>
                  <td className="p-2 whitespace-nowrap">{fmtMinutes(s.seconds)}</td>
                  <td className="p-2">{s.actions}</td>
                  <td className="p-2 whitespace-nowrap">
                    {s.quizAnswered ? `${Math.round((100 * s.quizCorrect) / s.quizAnswered)}% (${s.quizCorrect}/${s.quizAnswered})` : "—"}
                  </td>
                  <td className="p-2 text-xs">{s.units.join(" · ") || "—"}</td>
                  <td className="p-2 whitespace-nowrap text-xs">{formatHebDate(s.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-2 mt-6 font-display text-lg font-bold text-[color:var(--primary)]">❗ השאלות שהכיתה טועה בהן הכי הרבה</h3>
      {missed.length === 0 ? (
        <p className="text-sm">אין עדיין טעויות בחידון.</p>
      ) : (
        <ol className="space-y-2">
          {missed.map((m) => (
            <li key={m.id} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-bold">{m.prompt}</span>
                <span className="rounded-full bg-[color:var(--danger)]/12 px-2 py-0.5 text-xs font-bold text-[color:var(--danger)]">
                  {Math.round((100 * m.wrong) / m.answered)}% טעויות ({m.wrong}/{m.answered})
                </span>
              </div>
              <p className="mt-1 text-xs text-[color:var(--foreground)]/70">
                {m.unitTitle} · 📖 {m.part}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
