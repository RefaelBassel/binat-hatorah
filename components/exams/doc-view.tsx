import {
  type ExamDoc,
  type PrepDoc,
  examTotal,
  partTotal,
  subLabel,
} from "@/lib/exams-types";

// Read-only renderers shared by the print page, the student reading page and
// the exam taker. No hooks and no server APIs, so they work in both server and
// client components. The rubric is only ever rendered when `showRubric` is set
// — the print page passes it for the teacher's rubric printout, and student
// pages receive documents whose rubric fields are already empty.

function Rubric({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <div className="mt-1.5 whitespace-pre-wrap rounded-md border border-dashed border-[color:var(--warning)] bg-[color:var(--warning)]/10 px-3 py-1.5 text-[0.92em] leading-7">
      <b>מחוון / תשובה לדוגמה: </b>
      {text}
    </div>
  );
}

function pointsLabel(p: number | null): string {
  return p === null ? "" : ` (${p} ${p === 1 ? "נקודה" : "נקודות"})`;
}

export function ExamSheet({
  doc,
  title,
  showRubric = false,
  withNameLine = false,
  renderAnswer,
}: {
  doc: ExamDoc;
  title: string;
  showRubric?: boolean;
  withNameLine?: boolean;
  renderAnswer?: (key: string) => React.ReactNode;
}) {
  let n = 0;
  return (
    <article dir="rtl" lang="he" className="text-[17px] leading-8">
      <header className="mb-6 border-b-2 border-current pb-3">
        <h1 className="font-display text-3xl font-extrabold leading-tight">{title}</h1>
        <p className="mt-2 text-base">
          {doc.durationMin ? `זמן המבחן: ${doc.durationMin} דקות · ` : ""}
          סך הכול: {examTotal(doc)} נקודות
        </p>
        {withNameLine && (
          <p className="mt-4 flex gap-8 text-base">
            <span>שם: ______________________</span>
            <span>תאריך: ______________</span>
          </p>
        )}
      </header>

      {doc.parts.map((part) => (
        <section key={part.id} className="mb-8">
          <h2 className="font-display text-2xl font-extrabold">
            {part.title}
            {pointsLabel(part.points ?? partTotal(part))}
          </h2>
          {part.instructions.trim() && (
            <p className="mt-1 whitespace-pre-wrap font-semibold">{part.instructions}</p>
          )}
          <div className="mt-4 space-y-5">
            {part.questions.map((q) => {
              n++;
              return (
                <div key={q.id} className="break-inside-avoid-page">
                  <p className="whitespace-pre-wrap">
                    <b>{n}. </b>
                    {q.text}
                    {pointsLabel(q.points)}
                  </p>
                  {q.subs.length === 0 && renderAnswer?.(q.id)}
                  {q.subs.length > 0 && (
                    <ol className="mt-1 space-y-2.5">
                      {q.subs.map((s, i) => (
                        <li key={s.id} className="list-none">
                          <p className="whitespace-pre-wrap ps-7 -indent-7">
                            <b>{subLabel(i)} </b>
                            {s.text}
                            {pointsLabel(s.points)}
                          </p>
                          {renderAnswer?.(s.id)}
                          {showRubric && <Rubric text={s.rubric} />}
                        </li>
                      ))}
                    </ol>
                  )}
                  {q.footer.trim() && <p className="mt-2 whitespace-pre-wrap">{q.footer}</p>}
                  {showRubric && <Rubric text={q.rubric} />}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </article>
  );
}

export function PrepSheet({ doc, title }: { doc: PrepDoc; title: string }) {
  return (
    <article dir="rtl" lang="he" className="text-[17px] leading-8">
      <h1 className="mb-5 border-b-2 border-current pb-3 font-display text-3xl font-extrabold leading-tight">
        {title}
      </h1>
      <div className="space-y-4">
        {doc.blocks.map((b) => {
          if (b.type === "h") {
            return (
              <h2 key={b.id} className="pt-2 font-display text-2xl font-extrabold">
                {b.text}
              </h2>
            );
          }
          if (b.type === "p") {
            return (
              <p key={b.id} className="whitespace-pre-wrap">
                {b.text}
              </p>
            );
          }
          const items = b.items.filter((i) => i.trim().length > 0);
          const Tag = b.type === "ol" ? "ol" : "ul";
          return (
            <Tag
              key={b.id}
              className={`space-y-1.5 ${b.type === "ol" ? "list-decimal" : "list-disc"} marker:font-bold`}
              style={{ paddingInlineStart: "1.5rem" }}
            >
              {items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </Tag>
          );
        })}
      </div>
    </article>
  );
}
