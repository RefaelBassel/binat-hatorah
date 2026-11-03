"use client";

import type { ReactNode } from "react";
import type { QuestionBlock, TaskBlock, TaskSection } from "@/content/tasks/types";

// =============================================================================
// Part B as slides (issue #21): students gave up on a worksheet that LOOKS
// long, so by default they face one question at a time. Each slide carries
// the material its question leans on (the blocks right before it in the
// unit — source, verse, art, intro), in the unit's own block order. The
// teacher's hidden/added questions are already applied to `sections`.
// =============================================================================

export interface Slide {
  sectionIndex: number;
  section: TaskSection;
  material: TaskBlock[]; // shown above the question
  question: QuestionBlock | null; // null = a sub-task with reading only
  after: TaskBlock[]; // trailing material at the end of a sub-task
  keys: string[]; // answer keys of the question (one per field)
  qNumber: number; // 1-based among question slides; 0 for reading slides
}

export function buildSlides(sections: TaskSection[]): Slide[] {
  const slides: Slide[] = [];
  let qNumber = 0;
  sections.forEach((section, sectionIndex) => {
    let pending: TaskBlock[] = [];
    let lastOfSection: Slide | null = null;
    for (const block of section.blocks) {
      if (block.type !== "question") {
        pending.push(block);
        continue;
      }
      const q = block as QuestionBlock;
      qNumber += 1;
      lastOfSection = {
        sectionIndex,
        section,
        material: pending,
        question: q,
        after: [],
        keys: q.fields?.length ? q.fields.map((f) => `${q.key}:${f.key}`) : [q.key],
        qNumber,
      };
      slides.push(lastOfSection);
      pending = [];
    }
    if (pending.length) {
      if (lastOfSection) lastOfSection.after = pending;
      else
        slides.push({
          sectionIndex,
          section,
          material: pending,
          question: null,
          after: [],
          keys: [],
          qNumber: 0,
        });
    }
  });
  return slides;
}

// Same threshold the progress meter counts ("ההתקדמות נמדדת כמו היום").
export const isFilled = (v: string | undefined) => (v ?? "").trim().length >= 2;

export function slideAnswered(slide: Slide, answers: Record<string, string>) {
  return slide.keys.length > 0 && slide.keys.every((k) => isFilled(answers[k]));
}

// ----- the sticky progress banner (lives inside the task's status bar) -----
export function SlideBanner({
  slides,
  index,
  answers,
  furthest,
  onJump,
}: {
  slides: Slide[];
  index: number; // slides.length = the summary screen
  answers: Record<string, string>;
  furthest: number;
  onJump: (i: number) => void;
}) {
  const questionSlides = slides
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => s.question);
  const total = questionSlides.length;
  const onSummary = index >= slides.length;
  const current = slides[index];
  // a reading slide sits "before" the next question
  const nextQ = onSummary
    ? total
    : current?.question
      ? current.qNumber
      : (slides.slice(index).find((s) => s.question)?.qNumber ?? total);
  const pct =
    onSummary || total === 0
      ? 100
      : Math.round(((current?.question ? nextQ : nextQ - 1) / total) * 100);
  const answeredN = questionSlides.filter(({ s }) => slideAnswered(s, answers)).length;

  return (
    <div className="mt-2 border-t border-[color:var(--border)]/70 pt-2">
      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-[color:var(--primary)]">
          {onSummary
            ? "🏁 סיכום — לפני ההגשה"
            : current?.question
              ? `שאלה ${current.qNumber} מתוך ${total}`
              : `📖 קריאה לפני שאלה ${nextQ} מתוך ${total}`}
        </span>
        <span className="text-[11px] text-[color:var(--primary)]/55">
          נענו {answeredN} מתוך {total}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-[color:var(--border)]/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="ההתקדמות בדף העבודה"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {questionSlides.map(({ s, i }) => {
          const done = slideAnswered(s, answers);
          const isCurrent = i === index;
          const open = !done && i < furthest;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`שאלה ${s.qNumber}${done ? " — נענתה" : open ? " — פתוחה" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
              title={`שאלה ${s.qNumber}${done ? " · נענתה" : open ? " · פתוחה" : ""}`}
              className="flex h-6 w-6 items-center justify-center rounded-full transition hover:scale-110"
            >
              <span
                className={[
                  "block rounded-full transition-all",
                  isCurrent
                    ? "h-3.5 w-3.5 bg-[color:var(--primary-fill)] ring-2 ring-[color:var(--accent)] ring-offset-1 ring-offset-[color:var(--card)]"
                    : done
                      ? "h-2.5 w-2.5 bg-[color:var(--success)]"
                      : open
                        ? "h-2.5 w-2.5 border-2 border-[color:var(--warning)] bg-[color:var(--warning)]/20"
                        : "h-2.5 w-2.5 border border-[color:var(--primary)]/35",
                ].join(" ")}
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onJump(slides.length)}
          aria-current={onSummary ? "step" : undefined}
          className={[
            "ms-1 rounded-full px-2 py-0.5 text-[10px] font-bold transition",
            onSummary
              ? "bg-[color:var(--primary-fill)] text-white"
              : "border border-[color:var(--border)] text-[color:var(--primary)]/60 hover:border-[color:var(--accent)]",
          ].join(" ")}
        >
          🏁 סיכום
        </button>
      </div>
      <p className="mt-0.5 hidden text-[10px] text-[color:var(--primary)]/45 sm:block">
        <span className="text-[color:var(--success)]">●</span> נענתה ·{" "}
        <span className="text-[color:var(--warning)]">○</span> פתוחה ·{" "}
        <span className="text-[color:var(--primary)]">◉</span> השאלה הנוכחית — לחיצה על
        נקודה קופצת לשאלה
      </p>
    </div>
  );
}

// ----- one slide -----
export function SlideView({
  slide,
  index,
  count,
  answers,
  canAdvance,
  readOnly,
  renderBlock,
  onPrev,
  onNext,
  onSkip,
}: {
  slide: Slide;
  index: number;
  count: number;
  answers: Record<string, string>;
  canAdvance: boolean; // gates off (teacher) or already submitted
  readOnly: boolean;
  renderBlock: (b: TaskBlock) => ReactNode;
  onPrev: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const answered = slideAnswered(slide, answers);
  const nextEnabled = !slide.question || answered || canAdvance;
  const isLast = index === count - 1;
  const multi = slide.keys.length > 1;
  return (
    <section
      className="slide-in -mx-2 flex min-h-[calc(100dvh-15rem)] flex-col rounded-2xl border-2 border-[color:var(--primary)]/20 bg-[color:var(--card)] p-4 shadow-sm sm:mx-0 sm:min-h-0 sm:p-6"
    >
      <p className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-semibold text-[color:var(--primary)]/55">
        <span className="rounded-full bg-[color:var(--primary)]/8 px-2 py-0.5">
          תת-משימה {slide.sectionIndex + 1} · {slide.section.title}
        </span>
        {slide.section.minutes && (
          <span className="rounded-full bg-[color:var(--accent)]/12 px-2 py-0.5 text-[color:var(--accent)]">
            ⏳ ~{slide.section.minutes} דק׳
          </span>
        )}
      </p>
      <div className="flex-1 space-y-5">
        {slide.material.map((b) => (
          <div key={b.key}>{renderBlock(b)}</div>
        ))}
        {slide.question && <div>{renderBlock(slide.question)}</div>}
        {slide.after.map((b) => (
          <div key={b.key}>{renderBlock(b)}</div>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={onPrev}
              className="rounded-full border border-[color:var(--border)] px-5 py-2.5 text-xs font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
            >
              → הקודם
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onNext}
            disabled={!nextEnabled}
            className="rounded-full bg-[color:var(--primary-fill)] px-8 py-2.5 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {isLast ? "לסיכום ולהגשה ←" : "הבא ←"}
          </button>
        </div>
        {slide.question && !answered && (
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-end">
            {!nextEnabled && (
              <span className="text-[11px] text-[color:var(--primary)]/55">
                {multi
                  ? "״הבא״ ייפתח כשכל השדות יתמלאו"
                  : "״הבא״ ייפתח כשתכתבו תשובה"}
              </span>
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={onSkip}
                className="text-[11px] font-semibold text-[color:var(--accent)] underline-offset-2 hover:underline"
              >
                אחזור לזה אחר כך ↩
              </button>
            )}
          </div>
        )}
        <p className="text-center text-[10px] text-[color:var(--primary)]/40">
          כל מה שנכתב נשמר אוטומטית
        </p>
      </div>
    </section>
  );
}

// ----- the summary after the last question -----
export function SlidesSummary({
  slides,
  answers,
  onJump,
  onBack,
  children,
}: {
  slides: Slide[];
  answers: Record<string, string>;
  onJump: (i: number) => void;
  onBack: () => void;
  children?: ReactNode; // the plenary card + the submit card
}) {
  const rows = slides
    .map((s, i) => ({ s, i, done: slideAnswered(s, answers) }))
    .filter(({ s }) => s.question);
  const open = rows.filter((r) => !r.done);
  const short = (t: string) => (t.length > 90 ? `${t.slice(0, 90)}…` : t);
  return (
    <div className="slide-in space-y-6">
      <div className="rounded-2xl border-2 border-[color:var(--primary)]/20 bg-[color:var(--card)] p-5 shadow-sm sm:p-6">
        <h2 className="mb-1 font-display text-xl font-extrabold text-[color:var(--primary)]">
          🏁 סיכום דף העבודה
        </h2>
        <p className="mb-4 text-xs text-[color:var(--primary)]/60">
          נענו {rows.length - open.length} מתוך {rows.length} שאלות. לחיצה על שאלה
          מחזירה אליה.
        </p>

        {open.length > 0 && (
          <div className="mb-5 rounded-xl border border-[color:var(--warning)]/45 bg-[color:var(--warning)]/10 p-4">
            <p className="mb-2 text-sm font-bold text-[color:var(--warning)]">
              {open.length === 1
                ? "נשארה שאלה אחת פתוחה"
                : `נשארו ${open.length} שאלות פתוחות`}{" "}
              — כדאי לחזור אליהן לפני ההגשה
            </p>
            <ul className="space-y-1.5">
              {open.map(({ s, i }) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => onJump(i)}
                    className="flex w-full items-start gap-2 rounded-lg bg-[color:var(--card)] px-3 py-2 text-start text-xs text-[color:var(--foreground)] transition hover:ring-1 hover:ring-[color:var(--warning)]"
                  >
                    <span className="shrink-0 font-bold text-[color:var(--warning)]">
                      {s.qNumber}.
                    </span>
                    <span className="flex-1">{short(s.question!.prompt)}</span>
                    <span className="shrink-0 font-bold text-[color:var(--warning)]">
                      לחזור ←
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <ul className="space-y-1.5">
          {rows.map(({ s, i, done }) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onJump(i)}
                className="flex w-full items-start gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-start text-xs transition hover:border-[color:var(--accent)]"
              >
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                    done
                      ? "bg-[color:var(--success)] text-white"
                      : "border-2 border-[color:var(--warning)] text-[color:var(--warning)]",
                  ].join(" ")}
                >
                  {done ? "✓" : s.qNumber}
                </span>
                <span className="flex-1">
                  <span className="block text-[10px] text-[color:var(--primary)]/50">
                    {s.section.title}
                  </span>
                  <span className="text-[color:var(--foreground)]/85">
                    {short(s.question!.prompt)}
                  </span>
                </span>
                <span
                  className={[
                    "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold",
                    done
                      ? "bg-[color:var(--success)]/12 text-[color:var(--success)]"
                      : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
                  ].join(" ")}
                >
                  {done ? "נענתה" : "פתוחה"}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onBack}
          className="mt-4 rounded-full border border-[color:var(--border)] px-5 py-2 text-xs font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
        >
          → חזרה לשאלה האחרונה
        </button>
      </div>
      {children}
    </div>
  );
}

// ----- layout choice (issue #26): both layouts are equal options -----
export type SaveStatus = "idle" | "saving" | "saved" | "error";
type LayoutValue = "full" | "slides";

const LAYOUT_OPTIONS: { value: LayoutValue; label: string }[] = [
  { value: "full", label: "רציף" },
  { value: "slides", label: "שאלה אחרי שאלה" },
];

export function SaveStatusNote({ status }: { status: SaveStatus }) {
  if (status === "saving")
    return <span className="text-[10px] text-[color:var(--primary)]/50">שומר…</span>;
  if (status === "saved")
    return (
      <span className="save-fade text-[10px] font-semibold text-[color:var(--success)]">
        ✓ נשמר
      </span>
    );
  if (status === "error")
    return (
      <span className="text-[10px] font-semibold text-[color:var(--danger)]">
        לא נשמר — נסו שוב
      </span>
    );
  return null;
}

// Always-visible "תצוגה: רציף | שאלה אחרי שאלה" switch.
export function ViewSwitch({
  view,
  onChange,
  status,
}: {
  view: LayoutValue | null; // null = not chosen yet: neither side is lit
  onChange: (v: LayoutValue) => void;
  status: SaveStatus;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-semibold text-[color:var(--primary)]/70">תצוגה:</span>
      <div
        role="radiogroup"
        aria-label="תצוגת דף העבודה"
        className="inline-flex overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--background)]"
      >
        {LAYOUT_OPTIONS.map((o) => {
          const on = o.value === view;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              disabled={status === "saving"}
              className={[
                "px-3 py-1 text-[11px] font-bold transition disabled:opacity-60",
                on
                  ? "bg-[color:var(--primary-fill)] text-white"
                  : "text-[color:var(--primary)] hover:bg-[color:var(--border)]/40",
              ].join(" ")}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      <SaveStatusNote status={status} />
    </div>
  );
}

// First-visit choice: two equal cards, neither pre-selected.
export function ViewChooser({
  onChoose,
  status,
}: {
  onChoose: (v: LayoutValue) => void;
  status: SaveStatus;
}) {
  const cards: { value: LayoutValue; title: string; text: string }[] = [
    { value: "full", title: "📄 דף עבודה רציף", text: "כל השאלות בדף אחד" },
    {
      value: "slides",
      title: "➡️ שאלה אחרי שאלה",
      text: "שאלה אחת בכל פעם, עם מד התקדמות",
    },
  ];
  return (
    <div className="rounded-2xl border-2 border-[color:var(--primary)]/25 bg-[color:var(--card)] p-5 text-center">
      <p className="font-display text-lg font-extrabold text-[color:var(--primary)]">
        איך נוח לך לעבוד על דף העבודה?
      </p>
      <p className="mt-1 text-xs text-[color:var(--primary)]/60">
        אפשר להחליף בכל רגע, בלי לאבד תשובות — והבחירה תישמר לכל המשימות.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {cards.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChoose(c.value)}
            disabled={status === "saving"}
            className="rounded-2xl border-2 border-[color:var(--border)] bg-[color:var(--background)] p-4 text-start transition hover:border-[color:var(--accent)] disabled:opacity-60"
          >
            <span className="block font-display text-base font-bold text-[color:var(--primary)]">
              {c.title}
            </span>
            <span className="mt-1 block text-xs text-[color:var(--foreground)]/70">
              {c.text}
            </span>
          </button>
        ))}
      </div>
      <div className="mt-2 min-h-4">
        <SaveStatusNote status={status} />
      </div>
    </div>
  );
}

// Small progress meter for the continuous layout ("נענו 4 מתוך 9").
export function MiniProgress({
  slides,
  answers,
}: {
  slides: Slide[];
  answers: Record<string, string>;
}) {
  const qs = slides.filter((s) => s.question);
  const total = qs.length;
  const done = qs.filter((s) => slideAnswered(s, answers)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="whitespace-nowrap text-[11px] font-semibold text-[color:var(--primary)]/70">
        נענו {done} מתוך {total}
      </span>
      <div
        className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]/50"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="ההתקדמות בדף העבודה"
      >
        <div
          className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)] transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
