import {
  type ExamBody,
  answerItems,
  fmtPoints,
  partComputedPoints,
  type PrepBody,
  examTotal,
  partLabel,
  questionNumbers,
  questionPoints,
  subLabel,
} from "@/lib/exam-types";
import type { ExamTips } from "@/lib/exam-tips";

// Read-only rendering of an exam / prep sheet — for printing, for the
// teacher's marking-guide print, and for students' reading page. The marking
// guide shows only when showRubric is set (teacher pages only).

export function pointsText(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} נקודות`;
}

export function ExamView({
  title,
  durationMin,
  body,
  showRubric = false,
}: {
  title: string;
  durationMin: number | null;
  body: ExamBody;
  showRubric?: boolean;
}) {
  const nums = questionNumbers(body);
  const total = examTotal(body);
  // sub-items without points of their own share the question's points
  const itemPoints = new Map(answerItems(body).map((it) => [it.key, it.maxPoints]));
  return (
    <article className="exam-doc space-y-6 leading-7">
      <header className="border-b-2 border-[color:var(--primary)]/40 pb-3 text-center">
        <h1 className="font-display text-2xl font-extrabold">
          {title || "מבחן ללא כותרת"}
          {showRubric && " · מחוון"}
        </h1>
        <p className="mt-1 text-sm">
          {durationMin ? `זמן: ${durationMin} דקות · ` : ""}סך הכול: {pointsText(total)}
        </p>
      </header>
      {body.parts.map((p, pi) => (
        <section key={p.id} className="break-inside-avoid-page space-y-3">
          <h2 className="font-display text-lg font-bold">
            {partLabel(pi)}
            {p.title ? `: ${p.title}` : ""}
            {p.points != null && ` (${pointsText(p.points)}${p.instructions === "חובה" ? ", חובה" : ""})`}
          </h2>
          {p.instructions && p.instructions !== "חובה" && (
            <p className="whitespace-pre-wrap text-sm font-semibold">{p.instructions}</p>
          )}
          <ol className="space-y-4">
            {p.questions.map((q) => (
              <li key={q.id} className="break-inside-avoid">
                <p className="whitespace-pre-wrap">
                  <span className="font-bold">{nums.get(q.id)}. </span>
                  {p.choose == null && questionPoints(q) > 0 && (
                    <span className="font-semibold">({pointsText(questionPoints(q))}) </span>
                  )}
                  {q.text}
                </p>
                {showRubric && q.rubric.trim() && <Rubric text={q.rubric} />}
                {q.subs.length > 0 && (
                  <ul className="mt-1 space-y-1 ps-6">
                    {q.subs.map((s, si) => (
                      <li key={s.id}>
                        <p className="whitespace-pre-wrap">
                          <span className="font-semibold">{subLabel(si)} </span>
                          {s.text}
                          {s.points != null && <span className="text-sm"> ({pointsText(s.points)})</span>}
                          {showRubric && s.points == null && (itemPoints.get(`${q.id}:${s.id}`) ?? 0) > 0 && (
                            <span className="text-sm"> ({pointsText(itemPoints.get(`${q.id}:${s.id}`) ?? 0)})</span>
                          )}
                        </p>
                        {showRubric && s.rubric.trim() && <Rubric text={s.rubric} />}
                      </li>
                    ))}
                  </ul>
                )}
                {q.footer?.trim() && <p className="mt-1 whitespace-pre-wrap">{q.footer}</p>}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {showRubric && <RubricSummary body={body} total={total} />}
    </article>
  );
}

// Closing points summary of the marking guide, checked against the points the
// exam states for each part.
function RubricSummary({ body, total }: { body: ExamBody; total: number }) {
  return (
    <section className="break-inside-avoid space-y-2 border-t-2 border-[color:var(--primary)]/40 pt-4">
      <h2 className="font-display text-lg font-bold">סיכום נקודות</h2>
      <table className="w-full border-collapse text-sm">
        <tbody>
          {body.parts.map((p, pi) => {
            const got = partComputedPoints(p);
            const mismatch = p.points != null && Math.abs(p.points - got) > 0.05;
            return (
              <tr key={p.id} className="border-b border-black/20">
                <td className="py-1 pe-3 font-semibold">
                  {partLabel(pi)}
                  {p.title ? `: ${p.title}` : ""}
                </td>
                <td className="py-1 pe-3">
                  {p.choose != null && p.choose > 0 ? `${p.choose} מתוך ${p.questions.length} שאלות` : `${p.questions.length} שאלות`}
                </td>
                <td className="py-1 text-start font-bold">
                  {fmtPoints(got)}
                  {mismatch && (
                    <span className="ms-2 text-xs font-semibold text-[color:var(--danger)]">
                      (בכותרת החלק כתוב {fmtPoints(p.points ?? 0)})
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          <tr>
            <td className="py-1 pe-3 font-bold" colSpan={2}>
              סך הכול
            </td>
            <td className="py-1 text-start font-extrabold">{fmtPoints(total)}</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}

function Rubric({ text }: { text: string }) {
  return (
    <div className="mt-1 rounded-lg border-s-4 border-[color:var(--success)] bg-[color:var(--success)]/10 px-3 py-1.5 text-sm whitespace-pre-wrap">
      <span className="font-bold">מחוון: </span>
      {text}
    </div>
  );
}

// The shared "tips from marking the previous exam" box (issue #65). Solid
// borders and a light tint, so it survives printing in black and white.
export function TipsBox({ tips }: { tips: ExamTips }) {
  if (tips.items.length === 0) return null;
  return (
    <aside
      dir="rtl"
      className="break-inside-avoid rounded-xl border-2 border-s-8 border-[color:var(--accent)] bg-[color:var(--accent)]/10 p-4 text-start"
      style={{ printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" }}
    >
      <h2 className="font-display text-lg font-extrabold text-[color:var(--primary)]">{tips.title}</h2>
      <ol className="mt-2 list-decimal space-y-1.5 ps-6">
        {tips.items.map((x, i) => (
          <li key={i} className="whitespace-pre-wrap">
            {x}
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function PrepView({ title, body, tips }: { title: string; body: PrepBody; tips?: ExamTips | null }) {
  return (
    <article className="exam-doc space-y-4 leading-7">
      <h1 className="border-b-2 border-[color:var(--primary)]/40 pb-3 text-center font-display text-2xl font-extrabold">
        {title || "דף הכנה"}
      </h1>
      {tips && <TipsBox tips={tips} />}
      {body.blocks.map((b) => {
        if (b.type === "heading")
          return (
            <h2 key={b.id} className="pt-2 font-display text-lg font-bold text-[color:var(--primary)]">
              {b.text}
            </h2>
          );
        if (b.type === "text")
          return (
            <p key={b.id} className="whitespace-pre-wrap">
              {b.text}
            </p>
          );
        const items = b.items.filter((x) => x.trim());
        if (b.type === "numbered")
          return (
            <ol key={b.id} className="list-decimal space-y-1 ps-6">
              {items.map((x, i) => (
                <li key={i} className="whitespace-pre-wrap">
                  {x}
                </li>
              ))}
            </ol>
          );
        return (
          <ul key={b.id} className="list-disc space-y-1 ps-6">
            {items.map((x, i) => (
              <li key={i} className="whitespace-pre-wrap">
                {x}
              </li>
            ))}
          </ul>
        );
      })}
    </article>
  );
}
