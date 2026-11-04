"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ViewSwitch, type SaveStatus } from "@/components/task/worksheet-slides";
import type { TaskView } from "@/lib/task-view";
import { answerItems, partLabel, subLabel, fmtPoints, questionNumbers, partComputedPoints } from "@/lib/exam-types";
import {
  QUIZ_ROUND,
  quizPct,
  weakestUnit,
  type Flashcard,
  type MockExam,
  type OpenFeedback,
  type OpenPracticeQuestion,
  type PracticeUnit,
  type QuizAnswer,
  type QuizQuestion,
  type QuizVerdict,
  type UnitProgress,
} from "@/lib/practice-types";

// The practice tab of an exam (issue #34): progress map, quick quiz, flash
// cards, open questions with Claude feedback, and a timed sample exam.
// Nothing here is graded or reported.

type Mode = "map" | "quiz" | "cards" | "open" | "mock";

export interface PracticeHubProps {
  examId: number;
  units: PracticeUnit[];
  quizCounts: Record<string, number>; // unit ref -> closed questions available
  cards: Flashcard[];
  cardMarks: Record<string, boolean>;
  openQuestions: OpenPracticeQuestion[];
  progress: UnitProgress[];
  view: TaskView | null;
  durationMin: number;
  readOnly: boolean; // guest
}

const btn =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60";
const btnPrimary = `${btn} bg-[color:var(--primary-fill)] text-white shadow hover:shadow-md active:scale-[0.97]`;
const btnAccent = `${btn} bg-[color:var(--accent-fill)] text-white shadow hover:shadow-md active:scale-[0.97]`;
const btnGhost = `${btn} border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:bg-[color:var(--border)]/40`;
const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm sm:p-5";

function Spinner() {
  return <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />;
}

async function post<T>(examId: number, payload: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/exams/${examId}/practice`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null);
  const data = res ? await res.json().catch(() => null) : null;
  if (!res?.ok) throw new Error((data as { error?: string } | null)?.error || "אין חיבור. נסו שוב.");
  return data as T;
}

// Active practice time since the previous action; long idle gaps don't count.
function useActiveClock() {
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
  }, []);
  return useCallback(() => {
    const t = Date.now();
    const s = Math.min(180, Math.round((t - (last.current || t)) / 1000));
    last.current = t;
    return s;
  }, []);
}

function useView(initial: TaskView | null) {
  const [view, setView] = useState<TaskView | null>(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const change = async (next: TaskView) => {
    if (next === view) return;
    setView(next);
    setStatus("saving");
    const res = await fetch("/api/profile/task-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ view: next }),
    }).catch(() => null);
    setStatus(res?.ok ? "saved" : "error");
    if (res?.ok) setTimeout(() => setStatus("idle"), 2000);
  };
  return { view, layout: (view ?? "slides") as TaskView, status, change };
}

export default function PracticeHub(props: PracticeHubProps) {
  const [mode, setMode] = useState<Mode>("map");
  const router = useRouter();
  const v = useView(props.view);
  const unitTitle = useMemo(() => new Map(props.units.map((u) => [u.ref, u.title])), [props.units]);

  const back = () => {
    setMode("map");
    router.refresh();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (props.readOnly) {
    return <p className={`${card} text-center text-sm`}>כדי לתרגל צריך להתחבר עם חשבון Google של בית הספר.</p>;
  }

  const header = (title: string, withView: boolean) => (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <button type="button" onClick={back} className={btnGhost}>
        → חזרה לתרגול
      </button>
      <h3 className="font-display text-xl font-bold text-[color:var(--primary)]">{title}</h3>
      {withView ? <ViewSwitch view={v.view} onChange={v.change} status={v.status} /> : <span />}
    </div>
  );

  if (mode === "quiz")
    return (
      <div>
        {header("⚡ חידון מהיר", true)}
        <Quiz {...props} layout={v.layout} unitTitle={unitTitle} />
      </div>
    );
  if (mode === "cards")
    return (
      <div>
        {header("🃏 כרטיסיות זיכרון", false)}
        <Cards {...props} unitTitle={unitTitle} />
      </div>
    );
  if (mode === "open")
    return (
      <div>
        {header("✍️ תרגול שאלות פתוחות", true)}
        <OpenPractice {...props} layout={v.layout} unitTitle={unitTitle} />
      </div>
    );
  if (mode === "mock")
    return (
      <div>
        {header("⏱ מבחן לדוגמה", false)}
        <MockRunner examId={props.examId} durationMin={props.durationMin} />
      </div>
    );

  const quizTotal = Object.values(props.quizCounts).reduce((s, n) => s + n, 0);
  const modes: { key: Mode; icon: string; title: string; note: string; disabled?: boolean }[] = [
    { key: "quiz", icon: "⚡", title: "חידון מהיר", note: `סבב של ${QUIZ_ROUND} שאלות סגורות, משוב מיידי`, disabled: quizTotal === 0 },
    { key: "cards", icon: "🃏", title: "כרטיסיות זיכרון", note: `${props.cards.length} כרטיסים: פרשנים ופסוקי מפתח`, disabled: props.cards.length === 0 },
    { key: "open", icon: "✍️", title: "שאלות פתוחות", note: "כותבים תשובה ומקבלים משוב מקלוד", disabled: props.openQuestions.length === 0 },
    { key: "mock", icon: "⏱", title: "מבחן לדוגמה", note: `${props.durationMin} דקות, באותו מבנה של המבחן` },
  ];
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        {modes.map((m) => (
          <button
            key={m.key}
            type="button"
            disabled={m.disabled}
            onClick={() => {
              setMode(m.key);
              window.scrollTo({ top: 0 });
            }}
            className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)]/15 text-2xl">{m.icon}</span>
            <span>
              <span className="block font-display text-lg font-bold text-[color:var(--primary)]">{m.title}</span>
              <span className="block text-xs text-[color:var(--foreground)]/65">{m.disabled ? "אין עדיין חומר לתרגול כזה" : m.note}</span>
            </span>
          </button>
        ))}
      </div>
      <ProgressMap progress={props.progress} />
    </div>
  );
}

// ── Progress map ───────────────────────────────────────────────────────

function Bar({ value, tone }: { value: number; tone: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--border)]/60">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: tone }} />
    </div>
  );
}

function ProgressMap({ progress }: { progress: UnitProgress[] }) {
  const weak = weakestUnit(progress);
  const any = progress.some((u) => u.activity > 0);
  return (
    <section className={card}>
      <h3 className="mb-1 font-display text-lg font-bold text-[color:var(--primary)]">🗺 מפת ההתקדמות שלי</h3>
      <p className="mb-4 text-xs text-[color:var(--foreground)]/60">רק בשבילך. לא נכנס לציון.</p>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {progress.map((u) => {
          const pct = quizPct(u);
          const tone = pct == null ? "var(--border)" : pct >= 80 ? "var(--success)" : pct >= 55 ? "var(--warning)" : "var(--danger)";
          return (
            <li key={u.ref} className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-bold text-[color:var(--primary)]">{u.title}</span>
                <span className="rounded-full bg-[color:var(--border)]/50 px-2 py-0.5 text-[11px] font-semibold">
                  {u.activity === 0 ? "עוד לא תרגלת" : `${u.activity} פעולות תרגול`}
                </span>
              </div>
              <p className="mb-1 text-xs">חידון: {pct == null ? "—" : `${pct}% הצלחה (${u.quizCorrect}/${u.quizAnswered})`}</p>
              <Bar value={pct ?? 0} tone={tone} />
              <p className="mb-1 mt-2 text-xs">
                כרטיסיות: {u.cardsTotal === 0 ? "—" : `${u.cardsKnown} מתוך ${u.cardsTotal} כבר ידועים`}
              </p>
              <Bar value={u.cardsTotal ? (100 * u.cardsKnown) / u.cardsTotal : 0} tone="var(--primary)" />
            </li>
          );
        })}
      </ul>
      {weak && (
        <p className="mt-4 rounded-xl bg-[color:var(--accent)]/12 p-3 text-center text-sm font-bold text-[color:var(--accent)]">
          {any ? `💡 כדאי לחזור על: ${weak.title}` : `💡 אפשר להתחיל מכל יחידה. הצעה: ${weak.title}`}
        </p>
      )}
    </section>
  );
}

// ── Unit picker ────────────────────────────────────────────────────────

function UnitPicker({
  units,
  value,
  onChange,
  counts,
}: {
  units: PracticeUnit[];
  value: string;
  onChange: (v: string) => void;
  counts?: Record<string, number>;
}) {
  const opts = [{ ref: "all", title: "כל החומר" }, ...units.filter((u) => !counts || (counts[u.ref] ?? 0) > 0)];
  return (
    <div role="radiogroup" aria-label="בחירת יחידה" className="flex flex-wrap gap-2">
      {opts.map((u) => {
        const on = u.ref === value;
        return (
          <button
            key={u.ref}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(u.ref)}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              on
                ? "border-transparent bg-[color:var(--primary-fill)] text-white"
                : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:bg-[color:var(--border)]/40"
            }`}
          >
            {u.title}
            {counts && u.ref !== "all" ? ` (${counts[u.ref] ?? 0})` : ""}
          </button>
        );
      })}
    </div>
  );
}

// ── Quick quiz ─────────────────────────────────────────────────────────

function Quiz({
  examId,
  units,
  quizCounts,
  layout,
  unitTitle,
}: PracticeHubProps & { layout: TaskView; unitTitle: Map<string, string> }) {
  const [unit, setUnit] = useState("all");
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, QuizVerdict>>({});
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clock = useActiveClock();

  const start = async (only: string[] | null) => {
    setLoading(true);
    setError(null);
    try {
      const r = await post<{ questions: QuizQuestion[] }>(examId, { action: "quiz-round", unit, only });
      if (r.questions.length === 0) throw new Error("אין שאלות ביחידה הזו.");
      setQuestions(r.questions);
      setVerdicts({});
      setIdx(0);
      clock();
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setLoading(false);
    }
  };

  if (!questions) {
    return (
      <div className={`${card} space-y-4`}>
        <p className="text-sm">
          {QUIZ_ROUND} שאלות בסדר אקראי מבדיקות ההבנה של היחידות. אחרי כל תשובה תראו מיד אם צדקתם, מה התשובה הנכונה ואיפה זה כתוב.
        </p>
        <UnitPicker units={units} value={unit} onChange={setUnit} counts={quizCounts} />
        <button type="button" className={btnPrimary} disabled={loading} onClick={() => start(null)}>
          {loading ? <Spinner /> : null}
          {loading ? "מכין סבב…" : "התחלת סבב"}
        </button>
        {error && <p className="text-sm font-bold text-[color:var(--danger)]">{error}</p>}
      </div>
    );
  }

  const answered = Object.keys(verdicts).length;
  const correct = Object.values(verdicts).filter((x) => x.correct).length;
  const done = answered === questions.length;
  const wrongIds = questions.filter((q) => verdicts[q.id] && !verdicts[q.id].correct).map((q) => q.id);
  const onVerdict = (id: string, v: QuizVerdict) => setVerdicts((m) => ({ ...m, [id]: v }));

  const summary = (
    <div className={`${card} text-center`}>
      <p className="text-4xl">{correct === questions.length ? "🏆" : correct >= questions.length * 0.7 ? "🌟" : "💪"}</p>
      <p className="mt-2 font-display text-2xl font-bold text-[color:var(--primary)]">
        {correct} מתוך {questions.length} תשובות נכונות
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {wrongIds.length > 0 && (
          <button type="button" className={btnAccent} disabled={loading} onClick={() => start(wrongIds)}>
            {loading ? <Spinner /> : null}
            תרגלו שוב את מה שטעיתם ({wrongIds.length})
          </button>
        )}
        <button type="button" className={btnPrimary} disabled={loading} onClick={() => start(null)}>
          סבב חדש
        </button>
        <button type="button" className={btnGhost} onClick={() => setQuestions(null)}>
          בחירת יחידה אחרת
        </button>
      </div>
      {error && <p className="mt-2 text-sm font-bold text-[color:var(--danger)]">{error}</p>}
    </div>
  );

  const progressLine = (
    <div className="mb-3">
      <div className="mb-1 flex justify-between text-xs font-semibold text-[color:var(--primary)]/80">
        <span>
          ענית על {answered} מתוך {questions.length}
        </span>
        <span>{correct} נכונות</span>
      </div>
      <Bar value={(100 * answered) / questions.length} tone="var(--accent)" />
    </div>
  );

  if (layout === "slides") {
    const q = questions[Math.min(idx, questions.length - 1)];
    const showSummary = done && idx >= questions.length;
    return (
      <div className="space-y-4">
        {progressLine}
        {showSummary ? (
          summary
        ) : (
          <>
            <QuizCard
              key={q.id}
              examId={examId}
              q={q}
              n={idx + 1}
              unitTitle={unitTitle.get(q.unitRef) ?? ""}
              verdict={verdicts[q.id] ?? null}
              onVerdict={onVerdict}
              clock={clock}
            />
            <div className="flex justify-between gap-2">
              <button type="button" className={btnGhost} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
                → הקודמת
              </button>
              <button
                type="button"
                className={verdicts[q.id] ? btnPrimary : btnGhost}
                onClick={() => setIdx(idx + 1 >= questions.length ? (done ? questions.length : idx) : idx + 1)}
                disabled={idx + 1 >= questions.length && !done}
              >
                {idx + 1 >= questions.length ? "לסיכום הסבב" : "לשאלה הבאה ←"}
              </button>
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {progressLine}
      {questions.map((q, i) => (
        <QuizCard
          key={q.id}
          examId={examId}
          q={q}
          n={i + 1}
          unitTitle={unitTitle.get(q.unitRef) ?? ""}
          verdict={verdicts[q.id] ?? null}
          onVerdict={onVerdict}
          clock={clock}
        />
      ))}
      {done && summary}
    </div>
  );
}

function QuizCard({
  examId,
  q,
  n,
  unitTitle,
  verdict,
  onVerdict,
  clock,
}: {
  examId: number;
  q: QuizQuestion;
  n: number;
  unitTitle: string;
  verdict: QuizVerdict | null;
  onVerdict: (id: string, v: QuizVerdict) => void;
  clock: () => number;
}) {
  const [choice, setChoice] = useState<string | number | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locked = verdict != null;

  const answer: QuizAnswer | null =
    q.kind === "order" ? (order.length === q.options.length ? order : null) : choice;

  const check = async () => {
    if (answer == null) return;
    setBusy(true);
    setError(null);
    try {
      const v = await post<QuizVerdict>(examId, { action: "quiz-answer", id: q.id, answer, seconds: clock() });
      onVerdict(q.id, v);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  };

  const optBtn = (on: boolean) =>
    `w-full rounded-xl border px-3 py-2.5 text-right text-sm transition ${
      on
        ? "border-[color:var(--primary)] bg-[color:var(--primary)]/12 font-bold text-[color:var(--primary)]"
        : "border-[color:var(--border)] bg-[color:var(--background)] hover:bg-[color:var(--border)]/40"
    } disabled:cursor-default`;

  return (
    <article className={card}>
      <p className="mb-1 text-[11px] font-semibold text-[color:var(--accent)]">
        שאלה {n} · {unitTitle} · {q.kind === "truefalse" ? "נכון / לא נכון" : q.kind === "order" ? "סידור" : "אמריקאית"}
      </p>
      <p className="mb-3 font-bold leading-relaxed">{q.prompt}</p>

      {q.kind === "choice" && (
        <div className="space-y-2">
          {q.options.map((o) => (
            <button key={o} type="button" disabled={locked} onClick={() => setChoice(o)} className={optBtn(choice === o)}>
              {o}
            </button>
          ))}
        </div>
      )}
      {q.kind === "truefalse" && (
        <div className="grid grid-cols-2 gap-2">
          {["נכון", "לא נכון"].map((o, i) => (
            <button key={o} type="button" disabled={locked} onClick={() => setChoice(i)} className={`${optBtn(choice === i)} text-center`}>
              {o}
            </button>
          ))}
        </div>
      )}
      {q.kind === "order" && (
        <div className="space-y-2">
          <p className="text-xs text-[color:var(--foreground)]/65">הקישו על הפריטים לפי הסדר הנכון, מהראשון לאחרון.</p>
          {q.options.map((o) => {
            const pos = order.indexOf(o);
            return (
              <button
                key={o}
                type="button"
                disabled={locked}
                onClick={() => setOrder(pos >= 0 ? order.filter((x) => x !== o) : [...order, o])}
                className={`${optBtn(pos >= 0)} flex items-center gap-3`}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs">
                  {pos >= 0 ? pos + 1 : ""}
                </span>
                <span>{o}</span>
              </button>
            );
          })}
          {!locked && order.length > 0 && (
            <button type="button" className="text-xs font-semibold text-[color:var(--primary)] underline" onClick={() => setOrder([])}>
              איפוס הסדר
            </button>
          )}
        </div>
      )}

      {!locked && (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className={btnPrimary} disabled={answer == null || busy} onClick={check}>
            {busy ? <Spinner /> : null}
            {busy ? "בודק…" : "בדיקה"}
          </button>
          {error && <span className="text-sm font-bold text-[color:var(--danger)]">{error}</span>}
        </div>
      )}
      {verdict && (
        <div
          className={`mt-4 rounded-xl border p-3 text-sm ${
            verdict.correct
              ? "border-[color:var(--success)]/40 bg-[color:var(--success)]/10"
              : "border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10"
          }`}
          aria-live="polite"
        >
          <p className={`font-bold ${verdict.correct ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>
            {verdict.correct ? "✓ נכון!" : "✗ לא נכון"}
          </p>
          {!verdict.correct && (
            <div className="mt-1">
              <span className="font-semibold">התשובה הנכונה: </span>
              {Array.isArray(verdict.correctAnswer) ? (
                <ol className="mt-1 list-decimal space-y-0.5 pr-5">
                  {verdict.correctAnswer.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              ) : (
                verdict.correctAnswer
              )}
            </div>
          )}
          {verdict.part && <p className="mt-1 text-[color:var(--foreground)]/75">📖 {verdict.part}</p>}
        </div>
      )}
    </article>
  );
}

// ── Flash cards ────────────────────────────────────────────────────────

function buildDeck(cards: Flashcard[], marks: Record<string, boolean>): string[] {
  // cards marked "צריך לחזור" first, then unseen, then known (shuffled in each)
  const rank = (c: Flashcard) => (marks[c.id] === false ? 0 : marks[c.id] === undefined ? 1 : 2);
  return cards
    .map((c) => ({ id: c.id, k: rank(c) + Math.random() * 0.9 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.id);
}

function Cards({
  examId,
  units,
  cards,
  cardMarks,
  unitTitle,
}: PracticeHubProps & { unitTitle: Map<string, string> }) {
  const [unit, setUnit] = useState("all");
  const [marks, setMarks] = useState<Record<string, boolean>>(cardMarks);
  const pool = useMemo(() => cards.filter((c) => unit === "all" || c.unitRef === unit), [cards, unit]);
  const [queue, setQueue] = useState<string[]>(() => buildDeck(cards, cardMarks));
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState<"known" | "again" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [knownThisRound, setKnownThisRound] = useState(0);
  const clock = useActiveClock();
  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cards) m[c.unitRef] = (m[c.unitRef] ?? 0) + 1;
    return m;
  }, [cards]);

  const restart = (u: string, m = marks) => {
    setUnit(u);
    setQueue(buildDeck(cards.filter((c) => u === "all" || c.unitRef === u), m));
    setFlipped(false);
    setKnownThisRound(0);
  };

  const current = queue[0] ? byId.get(queue[0]) : undefined;

  const mark = async (known: boolean) => {
    if (!current) return;
    setBusy(known ? "known" : "again");
    setError(null);
    try {
      await post(examId, { action: "card", id: current.id, known, seconds: clock() });
      setMarks((m) => ({ ...m, [current.id]: known }));
      setFlipped(false);
      if (known) {
        setKnownThisRound((n) => n + 1);
        setQueue((q) => q.slice(1));
      } else {
        // comes back soon: three cards later (or at the end of a short deck)
        setQueue((q) => {
          const rest = q.slice(1);
          const at = Math.min(3, rest.length);
          return [...rest.slice(0, at), current.id, ...rest.slice(at)];
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  };

  const known = pool.filter((c) => marks[c.id]).length;
  return (
    <div className="space-y-4">
      <UnitPicker units={units} value={unit} onChange={(u) => restart(u)} counts={counts} />
      <p className="text-xs font-semibold text-[color:var(--primary)]/80">
        {known} מתוך {pool.length} כרטיסים כבר ידועים · נותרו בסבב: {queue.length}
      </p>
      {current ? (
        <div className="mx-auto max-w-xl">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            aria-label={flipped ? "הצגת הצד הראשון" : "הפיכת הכרטיס"}
            className={`flex min-h-[13rem] w-full flex-col items-center justify-center rounded-3xl border-2 p-6 text-center shadow-md transition ${
              flipped
                ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10"
                : "border-[color:var(--primary)]/40 bg-[color:var(--card)]"
            }`}
          >
            <span className="mb-2 text-[11px] font-semibold text-[color:var(--accent)]">
              {unitTitle.get(current.unitRef) ?? "כללי"} · {flipped ? "הצד השני" : "הקישו כדי להפוך"}
            </span>
            <span className={`leading-relaxed ${flipped ? "text-base" : "font-display text-lg font-bold text-[color:var(--primary)]"}`}>
              {flipped ? current.back : current.front}
            </span>
          </button>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" className={`${btn} bg-[color:var(--success-fill)] text-white shadow`} disabled={busy != null} onClick={() => mark(true)}>
              {busy === "known" ? <Spinner /> : "✓"} ידעתי
            </button>
            <button type="button" className={`${btn} bg-[color:var(--warning-fill)] text-white shadow`} disabled={busy != null} onClick={() => mark(false)}>
              {busy === "again" ? <Spinner /> : "↺"} צריך לחזור
            </button>
          </div>
          {error && <p className="mt-2 text-center text-sm font-bold text-[color:var(--danger)]">{error}</p>}
        </div>
      ) : (
        <div className={`${card} text-center`}>
          <p className="text-4xl">🎉</p>
          <p className="mt-2 font-display text-xl font-bold text-[color:var(--primary)]">סיימתם את הסבב!</p>
          <p className="mt-1 text-sm">ידעתם {knownThisRound} כרטיסים בסבב הזה.</p>
          <button type="button" className={`${btnPrimary} mt-4`} onClick={() => restart(unit)}>
            סבב נוסף
          </button>
        </div>
      )}
    </div>
  );
}

// ── Open questions ─────────────────────────────────────────────────────

function useLocalDraft(key: string) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (raw) setDrafts(JSON.parse(raw));
    } catch {}
  }, [key]);
  const set = (id: string, v: string) =>
    setDrafts((d) => {
      const next = { ...d, [id]: v };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [drafts, set] as const;
}

function FeedbackBox({ f }: { f: OpenFeedback }) {
  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm" aria-live="polite">
      <p>
        <span className="font-bold text-[color:var(--success)]">👍 מה טוב: </span>
        {f.good}
      </p>
      <p>
        <span className="font-bold text-[color:var(--warning)]">🧩 מה חסר: </span>
        {f.missing}
      </p>
      <p>
        <span className="font-bold text-[color:var(--accent)]">💡 רמז לשיפור: </span>
        {f.hint}
      </p>
    </div>
  );
}

function OpenPractice({
  examId,
  units,
  openQuestions,
  layout,
  unitTitle,
}: PracticeHubProps & { layout: TaskView; unitTitle: Map<string, string> }) {
  const [unit, setUnit] = useState("all");
  const [idx, setIdx] = useState(0);
  const [drafts, setDraft] = useLocalDraft(`practice-open-${examId}`);
  const [feedback, setFeedback] = useState<Record<string, OpenFeedback>>({});
  const clock = useActiveClock();
  const list = openQuestions.filter((q) => unit === "all" || q.unitRef === unit || q.unitRef === "");
  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const q of openQuestions) m[q.unitRef] = (m[q.unitRef] ?? 0) + 1;
    return m;
  }, [openQuestions]);

  const item = (q: OpenPracticeQuestion, n: number) => (
    <OpenItem
      key={q.id}
      examId={examId}
      q={q}
      n={n}
      unitTitle={unitTitle.get(q.unitRef) ?? "דף ההכנה"}
      value={drafts[q.id] ?? ""}
      onChange={(v) => setDraft(q.id, v)}
      feedback={feedback[q.id] ?? null}
      onFeedback={(f) => setFeedback((m) => ({ ...m, [q.id]: f }))}
      clock={clock}
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-sm">כתבו תשובה וקבלו מקלוד משוב קצר: מה טוב, מה חסר ורמז לשיפור. בלי ציון. התשובות נשמרות במכשיר הזה.</p>
      <UnitPicker units={units} value={unit} onChange={(u) => { setUnit(u); setIdx(0); }} counts={counts} />
      {list.length === 0 && <p className="text-sm">אין שאלות ביחידה הזו.</p>}
      {layout === "slides" && list.length > 0 ? (
        <>
          <p className="text-xs font-semibold text-[color:var(--primary)]/80">
            שאלה {Math.min(idx, list.length - 1) + 1} מתוך {list.length}
          </p>
          {item(list[Math.min(idx, list.length - 1)], Math.min(idx, list.length - 1) + 1)}
          <div className="flex justify-between gap-2">
            <button type="button" className={btnGhost} disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
              → הקודמת
            </button>
            <button type="button" className={btnGhost} disabled={idx >= list.length - 1} onClick={() => setIdx(idx + 1)}>
              הבאה ←
            </button>
          </div>
        </>
      ) : (
        list.map((q, i) => item(q, i + 1))
      )}
    </div>
  );
}

function OpenItem({
  examId,
  q,
  n,
  unitTitle,
  value,
  onChange,
  feedback,
  onFeedback,
  clock,
}: {
  examId: number;
  q: OpenPracticeQuestion;
  n: number;
  unitTitle: string;
  value: string;
  onChange: (v: string) => void;
  feedback: OpenFeedback | null;
  onFeedback: (f: OpenFeedback) => void;
  clock: () => number;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentText, setSentText] = useState<string | null>(null);
  const ask = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await post<{ feedback: OpenFeedback }>(examId, { action: "open-feedback", questionId: q.id, answer: value, seconds: clock() });
      onFeedback(r.feedback);
      setSentText(value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(false);
    }
  };
  const changedSince = feedback != null && sentText !== value;
  return (
    <article className={card}>
      <p className="mb-1 text-[11px] font-semibold text-[color:var(--accent)]">
        שאלה {n} · {unitTitle}
      </p>
      <p className="mb-3 font-bold leading-relaxed">{q.text}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        dir="rtl"
        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm leading-relaxed focus:border-[color:var(--primary)] focus:outline-none"
        placeholder="כתבו כאן את התשובה…"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="button" className={btnAccent} disabled={busy || value.trim().length < 2 || (feedback != null && !changedSince)} onClick={ask}>
          {busy ? <Spinner /> : "✨"}
          {busy ? "קלוד קורא…" : feedback ? (changedSince ? "משוב על הגרסה החדשה" : "התקבל משוב") : "קבלת משוב מקלוד"}
        </button>
        {error && <span className="text-sm font-bold text-[color:var(--danger)]">{error}</span>}
      </div>
      {feedback && <FeedbackBox f={feedback} />}
    </article>
  );
}

// ── Sample exam ────────────────────────────────────────────────────────

interface MockSession {
  mock: MockExam;
  deadline: number; // ms
  startedAt: number; // ms
  answers: Record<string, string>;
  feedback: Record<string, OpenFeedback> | null;
}

function MockRunner({ examId, durationMin }: { examId: number; durationMin: number }) {
  const key = `practice-mock-${examId}`;
  const [s, setS] = useState<MockSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState<"start" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from storage
      if (raw) setS(JSON.parse(raw));
    } catch {}
  }, [key]);
  const save = useCallback(
    (next: MockSession | null) => {
      setS(next);
      try {
        if (next) localStorage.setItem(key, JSON.stringify(next));
        else localStorage.removeItem(key);
      } catch {}
    },
    [key]
  );

  useEffect(() => {
    if (!s || s.feedback) return;
    const t = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [s]);

  const start = async () => {
    setBusy("start");
    setError(null);
    try {
      const r = await post<{ mock: MockExam }>(examId, { action: "mock-start" });
      const t = Date.now();
      submitted.current = false;
      save({ mock: r.mock, startedAt: t, deadline: t + r.mock.durationMin * 60_000, answers: {}, feedback: null });
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  };

  const submit = useCallback(async () => {
    if (!s || s.feedback || submitted.current) return;
    submitted.current = true;
    setBusy("submit");
    setError(null);
    try {
      const seconds = Math.round((Math.min(Date.now(), s.deadline) - s.startedAt) / 1000);
      const r = await post<{ feedback: Record<string, OpenFeedback> }>(examId, {
        action: "mock-feedback",
        mock: { title: s.mock.title, body: s.mock.body },
        answers: s.answers,
        seconds,
      });
      save({ ...s, feedback: r.feedback });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      submitted.current = false;
      setError(e instanceof Error ? e.message : "שגיאה");
    } finally {
      setBusy(null);
    }
  }, [examId, s, save]);

  const left = s ? Math.max(0, Math.round((s.deadline - nowMs) / 1000)) : 0;
  useEffect(() => {
    if (s && !s.feedback && left === 0 && !submitted.current) void submit();
  }, [left, s, submit]);

  if (!s) {
    return (
      <div className={`${card} space-y-3 text-center`}>
        <p className="text-4xl">⏱</p>
        <p className="font-display text-lg font-bold text-[color:var(--primary)]">מבחן לדוגמה · {durationMin} דקות</p>
        <p className="text-sm">
          בנוי באותו מבנה של המבחן האמיתי, עם שאלות אחרות מבנק השאלות של היחידות. בסוף תקבלו משוב מקלוד לכל תשובה. לא נשמר ציון.
        </p>
        <button type="button" className={btnAccent} disabled={busy != null} onClick={start}>
          {busy === "start" ? <Spinner /> : null}
          {busy === "start" ? "בונה מבחן…" : "פתיחת מבחן לדוגמה"}
        </button>
        {error && <p className="text-sm font-bold text-[color:var(--danger)]">{error}</p>}
      </div>
    );
  }

  const { body } = s.mock;
  const nums = questionNumbers(body);
  const items = answerItems(body);
  const answeredCount = items.filter((it) => (s.answers[it.key] ?? "").trim()).length;
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const fb = s.feedback;

  return (
    <div className="space-y-4">
      <div className="sticky top-16 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 shadow">
        <span className="font-bold text-[color:var(--primary)]">{s.mock.title}</span>
        {fb ? (
          <span className="text-sm font-bold text-[color:var(--success)]">הוגש · המשוב מופיע מתחת לכל תשובה</span>
        ) : (
          <span className={`font-mono text-lg font-bold ${left < 300 ? "text-[color:var(--danger)]" : "text-[color:var(--primary)]"}`} aria-live="off">
            ⏳ {mm}:{ss}
          </span>
        )}
        <span className="text-xs">
          ענית על {answeredCount} מתוך {items.length}
        </span>
      </div>
      {fb && Object.keys(fb).length === 0 && <p className={`${card} text-sm`}>לא נכתבו תשובות, ולכן אין משוב.</p>}

      {body.parts.map((p, pi) => (
        <section key={p.id} className={card}>
          <h4 className="font-display text-lg font-bold text-[color:var(--primary)]">
            {partLabel(pi)}: {p.title} ({fmtPoints(p.points ?? partComputedPoints(p))} נק׳)
          </h4>
          {p.instructions && <p className="mb-3 text-sm text-[color:var(--foreground)]/75">{p.instructions}</p>}
          <div className="space-y-5">
            {p.questions.map((q) => (
              <div key={q.id}>
                <p className="font-bold">
                  שאלה {nums.get(q.id)}. {q.text}
                </p>
                {q.chooseSubs ? <p className="text-xs text-[color:var(--accent)]">בחרו {q.chooseSubs} מהסעיפים.</p> : null}
                {(q.subs.length === 0 ? [{ id: "", text: "" }] : q.subs).map((sub, si) => {
                  const k = sub.id ? `${q.id}:${sub.id}` : q.id;
                  return (
                    <div key={k} className="mt-2">
                      {sub.text && (
                        <p className="mb-1 text-sm">
                          {subLabel(si)} {sub.text}
                        </p>
                      )}
                      {fb ? (
                        <>
                          <p className="whitespace-pre-wrap rounded-xl bg-[color:var(--background)] p-3 text-sm">
                            {s.answers[k]?.trim() || "(לא נענה)"}
                          </p>
                          {fb[k] && <FeedbackBox f={fb[k]} />}
                        </>
                      ) : (
                        <textarea
                          value={s.answers[k] ?? ""}
                          onChange={(e) => save({ ...s, answers: { ...s.answers, [k]: e.target.value } })}
                          rows={4}
                          dir="rtl"
                          className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3 text-sm focus:border-[color:var(--primary)] focus:outline-none"
                        />
                      )}
                    </div>
                  );
                })}
                {q.footer && <p className="mt-1 text-xs text-[color:var(--foreground)]/70">{q.footer}</p>}
              </div>
            ))}
          </div>
        </section>
      ))}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {!fb && (
          <button type="button" className={btnAccent} disabled={busy != null} onClick={submit}>
            {busy === "submit" ? <Spinner /> : null}
            {busy === "submit" ? "קלוד קורא את התשובות…" : "סיום וקבלת משוב"}
          </button>
        )}
        <button
          type="button"
          className={btnGhost}
          disabled={busy != null}
          onClick={() => {
            if (fb || window.confirm("לסגור את המבחן לדוגמה? התשובות יימחקו.")) save(null);
          }}
        >
          {fb ? "מבחן לדוגמה חדש" : "ביטול המבחן"}
        </button>
      </div>
      {error && <p className="text-center text-sm font-bold text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}
