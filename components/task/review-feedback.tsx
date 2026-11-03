import {
  COMPLETION_META,
  MARK_META,
  type CompletionStatus,
  type Marks,
} from "@/lib/completion-meta";

// What the student sees once the teacher approved the review (#24): the
// task's completion status and, beside each of their answers, the mark
// (✓ / ✗ / חלקי / לא רלוונטי) and the teacher's note. No numbers anywhere.
export default function ReviewFeedback({
  status,
  marks,
  feedback,
  questions,
}: {
  status: CompletionStatus;
  marks: Marks;
  feedback: string | null;
  questions: { key: string; section: string; label: string; prompt: string; answer: string }[];
}) {
  const meta = COMPLETION_META[status];
  const sections = [...new Set(questions.map((q) => q.section))];
  return (
    <section className="mb-8 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold text-[color:var(--primary)]">📋 המשוב על המשימה</h2>
        <span
          className="rounded-full px-4 py-1 text-sm font-bold"
          style={{ background: meta.bg, color: meta.color }}
        >
          {meta.label}
        </span>
      </div>
      {feedback?.trim() && (
        <p className="mb-4 whitespace-pre-wrap rounded-xl bg-[color:var(--success)]/10 px-4 py-3 text-sm leading-6 text-[color:var(--foreground)]/80">
          💬 {feedback}
        </p>
      )}
      <details open className="group">
        <summary className="cursor-pointer text-sm font-semibold text-[color:var(--accent)]">
          התשובות שלי והסימון של המורה
        </summary>
        <div className="mt-3 space-y-4">
          {sections.map((sec) => (
            <div key={sec}>
              <h3 className="mb-2 text-xs font-bold text-[color:var(--accent)]">{sec}</h3>
              <div className="space-y-2">
                {questions
                  .filter((q) => q.section === sec)
                  .map((q) => {
                    const m = marks[q.key];
                    const mm = m ? MARK_META[m.mark] : null;
                    return (
                      <div key={q.key} className="rounded-xl bg-[color:var(--background)] px-4 py-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-[color:var(--primary)]/65">{q.label}</p>
                          {mm && (
                            <span
                              className="shrink-0 rounded-full px-3 py-0.5 text-xs font-bold"
                              style={{ background: mm.bg, color: mm.color }}
                            >
                              {mm.symbol} {mm.label}
                            </span>
                          )}
                        </div>
                        <p className="mb-1 text-xs text-[color:var(--foreground)]/55">{q.prompt}</p>
                        {q.answer.trim() ? (
                          <p className="whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                            {q.answer}
                          </p>
                        ) : (
                          <p className="text-sm text-[color:var(--foreground)]/50">(לא נענתה)</p>
                        )}
                        {m?.note && (
                          <p className="mt-1.5 rounded-lg bg-[color:var(--primary)]/5 px-3 py-1.5 text-xs leading-5 text-[color:var(--primary)]">
                            ✏️ {m.note}
                          </p>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
