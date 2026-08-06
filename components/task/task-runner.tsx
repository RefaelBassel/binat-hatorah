"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  PassageBlock,
  TaskBlock,
  TaskContent,
  QuestionBlock,
} from "@/content/tasks/types";
import { DECODE_STAGES } from "@/content/tasks/registry";

// =============================================================================
// TaskRunner — the interactive task page body.
// Part A: the 8-stage pshat-decoding engine on the main passage (iron rule:
//         every task opens with structured interactive reading, never a bare
//         "read the text").
// Part B (stage 8): the teacher's worksheet sections.
// Includes: word-marking (hover/tap menu), personal question bank capture,
// Claude help everywhere ("אני עשיתי לבד אבל לא פגשתי קיר"), Israel clock +
// work stopwatch (pauses when the window loses focus), progress meter,
// submit / un-submit until the due date.
// =============================================================================

interface Marking {
  passageKey: string;
  wordIndex: number;
  wordText: string;
  kind: string;
  note?: string | null;
}

interface Props {
  taskId: number;
  content: TaskContent;
  mainPassage: PassageBlock;
  initialAnswers: Record<string, string>;
  initialMarkings: Marking[];
  initialStage: number;
  initialWorkSeconds: number;
  submitted: boolean;
  dueAt: number;
  totalUnits: number;
}

type MarkKind = "leitwort" | "hard" | "question";

const MARK_STYLE: Record<string, { bg: string; border: string; label: string; emoji: string }> = {
  leitwort: { bg: "#efe6f3", border: "#413055", label: "מילה מנחה", emoji: "📌" },
  hard: { bg: "#fdf3d7", border: "#b3892b", label: "מילה קשה", emoji: "🤔" },
  question: { bg: "#e3edf7", border: "#2f5d8a", label: "שאלה", emoji: "❓" },
};

export default function TaskRunner({
  taskId,
  content,
  mainPassage,
  initialAnswers,
  initialMarkings,
  initialStage,
  initialWorkSeconds,
  submitted: initialSubmitted,
  dueAt,
  totalUnits,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [markings, setMarkings] = useState<Marking[]>(initialMarkings);
  const [stage, setStage] = useState(Math.min(Math.max(initialStage, 1), 8));
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [workSeconds, setWorkSeconds] = useState(initialWorkSeconds);
  const [clock, setClock] = useState("");
  const [menu, setMenu] = useState<{
    passageKey: string;
    wordIndex: number;
    wordText: string;
    x: number;
    y: number;
  } | null>(null);
  // Claude assist — a real conversation: the student can reply and be guided
  // step by step ("אני עשיתי לבד אבל לא פגשתי קיר").
  const [assist, setAssist] = useState<{
    context: string;
    kind?: string;
    word?: string;
    messages: { role: "user" | "assistant"; content: string }[];
    loading: boolean;
  } | null>(null);
  const [assistDraft, setAssistDraft] = useState("");
  const [questionDraft, setQuestionDraft] = useState("");
  const [banked, setBanked] = useState<string[]>([]);
  const readOnly = submitted;

  // ---------- clock + work stopwatch ----------
  const pendingSeconds = useRef(0);
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setClock(
        new Intl.DateTimeFormat("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        }).format(new Date())
      );
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  useEffect(() => {
    if (submitted) return;
    // Tick only while the window is visible & focused — measures actual work.
    const tick = setInterval(() => {
      if (document.visibilityState === "visible" && document.hasFocus()) {
        pendingSeconds.current += 1;
        setWorkSeconds((s) => s + 1);
      }
    }, 1000);
    const flush = () => {
      const delta = pendingSeconds.current;
      if (delta <= 0) return;
      pendingSeconds.current = 0;
      fetch(`/api/tasks/${taskId}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seconds: delta }),
        keepalive: true,
      }).catch(() => {
        pendingSeconds.current += delta; // retry next flush
      });
    };
    const flushTimer = setInterval(flush, 20000);
    const onHide = () => flush();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(tick);
      clearInterval(flushTimer);
      flush();
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
    };
  }, [taskId, submitted]);

  // ---------- progress ----------
  const answeredCount = useMemo(() => {
    let n = 0;
    // decode stages 1-7 completed
    n += Math.min(stage - 1, 7);
    for (const section of content.sections) {
      for (const block of section.blocks) {
        if (block.type !== "question") continue;
        const keys = block.fields
          ? block.fields.map((f) => `${block.key}:${f.key}`)
          : [block.key];
        for (const k of keys) {
          if ((answers[k] ?? "").trim().length >= 2) n += 1;
        }
      }
    }
    return n;
  }, [answers, stage, content.sections]);
  const progressPct = Math.min(100, Math.round((answeredCount / totalUnits) * 100));

  const saveState = useCallback(
    (nextStage?: number) => {
      fetch(`/api/tasks/${taskId}/state`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: nextStage,
          progressPct: Math.min(
            100,
            Math.round(((answeredCount + (nextStage ? 1 : 0)) / totalUnits) * 100)
          ),
        }),
      }).catch(() => {});
    },
    [taskId, answeredCount, totalUnits]
  );

  // ---------- answers ----------
  const answerTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setAnswer = (key: string, value: string) => {
    setAnswers((a) => ({ ...a, [key]: value }));
    clearTimeout(answerTimers.current[key]);
    answerTimers.current[key] = setTimeout(() => {
      fetch(`/api/tasks/${taskId}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionKey: key, answer: value }),
      }).catch(() => {});
      saveState();
    }, 800);
  };

  // ---------- markings ----------
  const markOf = (passageKey: string, wordIndex: number) =>
    markings.filter((m) => m.passageKey === passageKey && m.wordIndex === wordIndex);

  const toggleMark = (kind: MarkKind) => {
    if (!menu || readOnly) return;
    const existing = markings.find(
      (m) =>
        m.passageKey === menu.passageKey &&
        m.wordIndex === menu.wordIndex &&
        m.kind === kind
    );
    const remove = Boolean(existing);
    setMarkings((ms) =>
      remove
        ? ms.filter((m) => m !== existing)
        : [...ms, { passageKey: menu.passageKey, wordIndex: menu.wordIndex, wordText: menu.wordText, kind }]
    );
    fetch(`/api/tasks/${taskId}/markings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        passageKey: menu.passageKey,
        wordIndex: menu.wordIndex,
        wordText: menu.wordText,
        kind,
        remove,
      }),
    }).catch(() => {});
    if (kind === "question") {
      setQuestionDraft(`על המילה ״${menu.wordText}״: `);
    }
    // Iron rule in action: marking a leitwort in stage 2 triggers immediate
    // formative feedback from Claude — affirming why a right choice works and
    // inviting deeper questions, or guiding a self-discovery when it doesn't.
    if (kind === "leitwort" && !remove && stage === 2) {
      askClaude(
        `שלב מילה מנחה — בדיקת הסימון של המילה ״${menu.wordText}״`,
        "",
        { kind: "leitwort", word: menu.wordText }
      );
    }
    setMenu(null);
  };

  // ---------- question bank ----------
  const bankQuestion = (question: string, sourceRef?: string) => {
    const q = question.trim();
    if (!q) return;
    setBanked((b) => [...b, q]);
    setQuestionDraft("");
    fetch(`/api/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, question: q, sourceRef: sourceRef ?? content.bookRef }),
    }).catch(() => {});
  };

  // ---------- Claude assist (conversational) ----------
  const askClaude = async (
    context: string,
    input: string,
    opts?: { kind?: string; word?: string }
  ) => {
    const prior =
      assist && assist.context === context ? assist.messages : [];
    const nextMessages = input
      ? [...prior, { role: "user" as const, content: input }]
      : prior;
    setAssist({
      context,
      kind: opts?.kind,
      word: opts?.word,
      messages: nextMessages,
      loading: true,
    });
    try {
      const res = await fetch(`/api/assist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          context,
          input,
          kind: opts?.kind,
          word: opts?.word,
          history: prior,
        }),
      });
      const data = await res.json();
      setAssist({
        context,
        kind: opts?.kind,
        word: opts?.word,
        messages: [
          ...nextMessages,
          { role: "assistant", content: data.reply ?? "" },
        ],
        loading: false,
      });
    } catch {
      setAssist({
        context,
        kind: opts?.kind,
        word: opts?.word,
        messages: [
          ...nextMessages,
          { role: "assistant", content: "משהו השתבש בחיבור — נסי שוב עוד רגע." },
        ],
        loading: false,
      });
    }
  };

  const replyToClaude = () => {
    if (!assist || !assistDraft.trim()) return;
    const draft = assistDraft.trim();
    setAssistDraft("");
    askClaude(assist.context, draft, { kind: assist.kind, word: assist.word });
  };

  // ---------- submit ----------
  const [submitBusy, setSubmitBusy] = useState(false);
  const doSubmit = async (action: "submit" | "unsubmit") => {
    setSubmitBusy(true);
    try {
      const res = await fetch(`/api/tasks/${taskId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.ok) setSubmitted(data.submitted);
      else if (data.error) alert(data.error);
    } finally {
      setSubmitBusy(false);
    }
  };

  const advanceStage = () => {
    const next = Math.min(stage + 1, 8);
    setStage(next);
    saveState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const overdue = Date.now() / 1000 > dueAt && !submitted;

  return (
    <div className="mx-auto w-full max-w-3xl" onClick={() => setMenu(null)}>
      {/* ===== sticky status bar: clock, stopwatch, progress ===== */}
      <div className="sticky top-[57px] z-20 -mx-2 mb-6 rounded-b-xl border-b border-x border-[color:var(--border)] bg-[color:var(--card)]/95 px-4 py-2 backdrop-blur">
        <div className="flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <span title="שעון ישראל" className="tabular-nums text-[color:var(--primary)]/60">
              🕐 {clock}
            </span>
            <span
              title="זמן עבודה בפועל (נעצר כשעוזבים את החלון)"
              className="tabular-nums font-semibold text-[color:var(--accent)]"
            >
              ⏱ {formatTimer(workSeconds)}
            </span>
          </div>
          <div className="flex flex-1 items-center gap-2 max-w-[50%]">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]/50">
              <div
                className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)] transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="whitespace-nowrap font-semibold text-[color:var(--primary)]">
              {progressPct}%
            </span>
          </div>
        </div>
      </div>

      {submitted && (
        <div className="mb-6 rounded-xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-4 py-3 text-sm text-[color:var(--success)]">
          ✅ המשימה הוגשה! עכשיו רגע קטן לעצמך — פתחי את לשונית 🪞 הרפלקציה שבצד
          וספרי איך היה. {Date.now() / 1000 <= dueAt && "אפשר לבטל את ההגשה ולתקן עד המועד האחרון."}
          {Date.now() / 1000 <= dueAt && (
            <button
              onClick={() => doSubmit("unsubmit")}
              disabled={submitBusy}
              className="ms-3 rounded-lg border border-[color:var(--success)]/50 px-3 py-1 text-xs font-semibold hover:bg-[color:var(--success)]/10"
            >
              ביטול הגשה ותיקון
            </button>
          )}
        </div>
      )}
      {overdue && (
        <div className="mb-6 rounded-xl border border-[color:var(--danger)]/40 bg-[color:var(--danger)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--danger)]">
          ⏰ המועד האחרון עבר — המשימה עדיין פתוחה להגשה, כדאי לסיים בהקדם!
        </div>
      )}

      {/* ===== stage rail ===== */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {DECODE_STAGES.map((s) => (
          <button
            key={s.n}
            onClick={() => s.n <= stage && setStage(s.n)}
            disabled={s.n > stage}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              s.n === stage
                ? "bg-[color:var(--primary)] text-white shadow"
                : s.n < stage
                  ? "bg-[color:var(--success)]/15 text-[color:var(--success)] hover:bg-[color:var(--success)]/25"
                  : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)]/40",
            ].join(" ")}
          >
            {s.n < stage ? "✓ " : ""}
            {s.n} · {s.title}
          </button>
        ))}
      </div>
      <p className="mb-6 text-xs text-[color:var(--accent)]">
        🎯 למה השלב הזה? <b>{DECODE_STAGES[stage - 1].why}</b>
      </p>

      {/* ===== Part A: decode stages 1-7 ===== */}
      {stage <= 7 && (
        <DecodeStage
          stage={stage}
          content={content}
          passage={mainPassage}
          answers={answers}
          setAnswer={setAnswer}
          markings={markings}
          markOf={markOf}
          setMenu={setMenu}
          readOnly={readOnly}
          questionDraft={questionDraft}
          setQuestionDraft={setQuestionDraft}
          bankQuestion={bankQuestion}
          banked={banked}
          askClaude={askClaude}
          advanceStage={advanceStage}
        />
      )}

      {/* ===== Part B (stage 8): the worksheet ===== */}
      {stage === 8 && (
        <div className="space-y-10">
          {content.sections.map((section, si) => (
            <section key={section.key}>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)] font-display text-sm font-bold text-white">
                  {si + 1}
                </span>
                <h2 className="font-display text-xl font-bold text-[color:var(--primary)]">
                  {section.title}
                </h2>
                {section.minutes && (
                  <span className="rounded-full bg-[color:var(--accent)]/15 px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--accent)]">
                    ⏳ ~{section.minutes} דק׳
                  </span>
                )}
              </div>
              <div className="space-y-5">
                {section.blocks.map((block) => (
                  <BlockView
                    key={block.key}
                    block={block}
                    answers={answers}
                    setAnswer={setAnswer}
                    markOf={markOf}
                    setMenu={setMenu}
                    readOnly={readOnly}
                    askClaude={askClaude}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* submit */}
          {!submitted && (
            <div className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-6 text-center">
              <p className="mb-1 font-display text-lg font-bold text-[color:var(--primary)]">
                סיימת? הגישי את המשימה 🎉
              </p>
              <p className="mb-4 text-xs text-[color:var(--primary)]/60">
                ענית על {answeredCount} מתוך {totalUnits} חלקים ({progressPct}%).
                אפשר לבטל הגשה ולתקן עד המועד האחרון.
              </p>
              <button
                onClick={() => doSubmit("submit")}
                disabled={submitBusy}
                className="rounded-full bg-[color:var(--primary)] px-10 py-3 text-sm font-bold text-white shadow-lg transition hover:scale-[1.02] disabled:opacity-50"
              >
                {submitBusy ? "מגישה..." : "הגשת המשימה ✨"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== word marking menu ===== */}
      {menu && !readOnly && (
        <div
          className="fixed z-50 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-2 shadow-xl"
          style={{
            left: Math.min(menu.x, typeof window !== "undefined" ? window.innerWidth - 230 : menu.x),
            top: menu.y + 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="mb-1.5 px-1 text-[11px] text-[color:var(--primary)]/60">
            המילה: <b className="text-[color:var(--primary)]">{menu.wordText}</b>
          </p>
          <div className="flex gap-1.5">
            {(Object.keys(MARK_STYLE) as MarkKind[]).map((kind) => {
              const st = MARK_STYLE[kind];
              const active = markings.some(
                (m) =>
                  m.passageKey === menu.passageKey &&
                  m.wordIndex === menu.wordIndex &&
                  m.kind === kind
              );
              return (
                <button
                  key={kind}
                  onClick={() => toggleMark(kind)}
                  className="rounded-full border px-2.5 py-1 text-[11px] font-semibold transition"
                  style={{
                    borderColor: st.border,
                    color: st.border,
                    background: active ? st.bg : "transparent",
                  }}
                >
                  {st.emoji} {st.label}
                  {active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => {
              askClaude(
                `התלמידה מבקשת עזרה על המילה ״${menu.wordText}״ בקטע ${content.bookRef}. שלב נוכחי: ${DECODE_STAGES[stage - 1].title}.`,
                `מה זאת המילה ״${menu.wordText}״?`
              );
              setMenu(null);
            }}
            className="mt-1.5 w-full rounded-lg bg-[color:var(--primary)]/5 px-2 py-1 text-[11px] text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
          >
            ✨ עזרה מקלוד על המילה הזו
          </button>
        </div>
      )}

      {/* ===== Claude assist panel — a guided conversation ===== */}
      {assist && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg rounded-2xl border border-[color:var(--primary)]/20 bg-[color:var(--card)] p-4 shadow-2xl">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)]">
                <span className="text-sm">✨</span>
              </div>
              <p className="text-[10px] text-[color:var(--primary)]/45">
                קלוד רומז ומכוון — לא פותר במקומך 💪 אפשר לענות לו!
              </p>
            </div>
            <button
              onClick={() => setAssist(null)}
              aria-label="סגירה"
              className="rounded-lg p-1 text-[color:var(--primary)]/50 hover:bg-[color:var(--primary)]/5"
            >
              ✕
            </button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {assist.messages.map((m, i) => (
              <p
                key={i}
                className={[
                  "whitespace-pre-wrap rounded-xl px-3 py-2 text-sm leading-6",
                  m.role === "assistant"
                    ? "bg-[color:var(--primary)]/5 text-[color:var(--foreground)]"
                    : "bg-[color:var(--accent)]/10 text-[color:var(--foreground)]/85",
                ].join(" ")}
              >
                {m.role === "user" && <b className="me-1 text-[color:var(--accent)]">את:</b>}
                {m.content}
              </p>
            ))}
            {assist.loading && (
              <p className="animate-pulse rounded-xl bg-[color:var(--primary)]/5 px-3 py-2 text-sm text-[color:var(--primary)]/60">
                קלוד חושב...
              </p>
            )}
          </div>
          {!readOnly && (
            <div className="mt-2 flex gap-2">
              <input
                value={assistDraft}
                onChange={(e) => setAssistDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && replyToClaude()}
                placeholder="עני לקלוד..."
                className="flex-1 rounded-full border border-[color:var(--border)] bg-white px-3.5 py-1.5 text-xs outline-none focus:border-[color:var(--accent)]"
              />
              <button
                onClick={replyToClaude}
                disabled={assist.loading || !assistDraft.trim()}
                className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                שליחה
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Decode stages 1-7
// =============================================================================

function DecodeStage(props: {
  stage: number;
  content: TaskContent;
  passage: PassageBlock;
  answers: Record<string, string>;
  setAnswer: (k: string, v: string) => void;
  markings: Marking[];
  markOf: (p: string, i: number) => Marking[];
  setMenu: (m: { passageKey: string; wordIndex: number; wordText: string; x: number; y: number } | null) => void;
  readOnly: boolean;
  questionDraft: string;
  setQuestionDraft: (v: string) => void;
  bankQuestion: (q: string, ref?: string) => void;
  banked: string[];
  askClaude: (context: string, input: string) => void;
  advanceStage: () => void;
}) {
  const {
    stage,
    content,
    passage,
    answers,
    setAnswer,
    markings,
    markOf,
    setMenu,
    readOnly,
    questionDraft,
    setQuestionDraft,
    bankQuestion,
    banked,
    askClaude,
    advanceStage,
  } = props;

  const leitworts = markings.filter((m) => m.passageKey === passage.key && m.kind === "leitwort");
  const hards = markings.filter((m) => m.passageKey === passage.key && m.kind === "hard");
  const decodeCfg = content.decode;

  const stageBody: Record<number, React.ReactNode> = {
    1: (
      <StageCard emoji="👋" title="קוראים פעם ראשונה — בלי לחץ">
        <p className="text-sm leading-7 text-[color:var(--foreground)]/75">
          קראי את הקטע בנחת. תוך כדי קריאה, לחצי על מילים שקשות לך (סמני 🤔) ועל
          מקומות שמעוררים לך שאלה (סמני ❓). עוד לא מנתחים — רק פוגשים.
        </p>
      </StageCard>
    ),
    2: (
      <StageCard emoji="📌" title="מילה מנחה — המילה שחוזרת שוב ושוב">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          מרטין בובר לימד: כשמילה (או משפחת מילים) חוזרת שוב ושוב בקטע — היא
          ״מילה מנחה״, מפתח לרעיון המרכזי. קראי שוב, וסמני 📌 את המילה שלדעתך
          מנחה את הקטע.
        </p>
        {leitworts.length > 0 && (
          <p className="mb-2 text-xs text-[color:var(--primary)]/70">
            סימנת: {leitworts.map((m) => `״${m.wordText}״`).join(", ")}
          </p>
        )}
        <FieldArea
          label="למה דווקא המילה הזו חוזרת? מה היא באה לומר על הקטע כולו?"
          value={answers["decode:leitwort-why"] ?? ""}
          onChange={(v) => setAnswer("decode:leitwort-why", v)}
          readOnly={readOnly}
        />
      </StageCard>
    ),
    3: (
      <StageCard emoji="🤔" title="מילים קשות — לדעת מה אני לא יודעת">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          עברי שוב על הקטע והשלימי את סימון כל המילים שאינך בטוחה בפירושן. זה לא
          כישלון — זו התחלת ההבנה! חוקרת אמיתית קודם ממפה את מה שלא ידוע.
        </p>
        {hards.length > 0 ? (
          <p className="text-xs text-[color:var(--primary)]/70">
            המילים שסימנת: {hards.map((m) => `״${m.wordText}״`).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-[color:var(--primary)]/50">
            עוד לא סימנת מילים קשות. אם באמת הכול מובן — מצוין, אפשר להמשיך!
          </p>
        )}
      </StageCard>
    ),
    4: (
      <StageCard emoji="🪞" title="תקבולת — המקרא מסביר את עצמו">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          {decodeCfg.hasParallelism
            ? "בקטע הזה יש תקבולת — שתי צלעות שאומרות רעיון דומה במילים שונות. מצאי אותה, ובדקי: האם הצלע המקבילה עוזרת להבין מילה קשה שסימנת?"
            : "תקבולת היא צמד צלעות שאומרות רעיון דומה במילים שונות — כלי נהדר לפענוח מילים קשות. בקטע סיפורי כמו שלנו תקבולת מלאה נדירה, אבל חפשי ביטויים שחוזרים במבנה דומה. מצאת משהו?"}
        </p>
        <FieldArea
          label="מה מצאת? האם זה עזר להבין מילה קשה?"
          value={answers["decode:parallelism"] ?? ""}
          onChange={(v) => setAnswer("decode:parallelism", v)}
          readOnly={readOnly}
        />
      </StageCard>
    ),
    5: (
      <StageCard emoji="🎭" title="סוגה — איזה מין טקסט זה?">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          חוק קוראים אחרת מסיפור, ושירה אחרת משניהם. איזו סוגה הקטע הזה?
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          {decodeCfg.genreOptions.map((g) => (
            <button
              key={g}
              disabled={readOnly}
              onClick={() => setAnswer("decode:genre", g)}
              className={[
                "rounded-full border px-4 py-1.5 text-sm font-semibold transition",
                (answers["decode:genre"] ?? "") === g
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white"
                  : "border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)] hover:border-[color:var(--accent)]",
              ].join(" ")}
            >
              {g}
            </button>
          ))}
        </div>
        <FieldArea
          label="איך הסוגה עוזרת לך להבין את הקטע?"
          value={answers["decode:genre-help"] ?? ""}
          onChange={(v) => setAnswer("decode:genre-help", v)}
          readOnly={readOnly}
        />
      </StageCard>
    ),
    6: (
      <StageCard emoji="❓" title="שאלת שאלות — כמה שיותר!">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          נחמה ליבוביץ לימדה: השאלה היא לב הלימוד. אחרי שהכלים עבדו — אילו
          שאלות נשארו? מה מפתיע? מה לא מסתדר? כל שאלה נכנסת למאגר השאלות האישי
          שלך, ובסוף השנה תבחרי מתוכו שאלה אחת לעבודה שלך. נסי לנסח לפחות{" "}
          {decodeCfg.minQuestions} שאלות.
        </p>
        <div className="mb-2 flex gap-2">
          <input
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && bankQuestion(questionDraft, passage.ref)}
            disabled={readOnly}
            placeholder="כתבי שאלה... (למשל: למה דווקא הם פנו למשה?)"
            className="flex-1 rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
          />
          <button
            onClick={() => bankQuestion(questionDraft, passage.ref)}
            disabled={readOnly || !questionDraft.trim()}
            className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            למאגר 💾
          </button>
        </div>
        {banked.length > 0 && (
          <ul className="space-y-1">
            {banked.map((q, i) => (
              <li key={i} className="rounded-lg bg-[color:var(--primary)]/5 px-3 py-1.5 text-xs text-[color:var(--primary)]">
                ❓ {q}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() =>
            askClaude(
              `שלב שאלת שאלות על ${passage.ref}. התלמידה מתקשה לנסח שאלות. שאלות שכבר שאלה: ${banked.join(" | ") || "(אין)"}`,
              "קשה לי לחשוב על שאלה"
            )
          }
          className="mt-2 text-xs text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          ✨ קשה לי לנסח שאלה — קלוד, עזור לי בקטנה
        </button>
      </StageCard>
    ),
    7: (
      <StageCard emoji="💪" title="מבינים בכל זאת — גם בלי כל המילים">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          גם אם נשארו מילים לא פתורות — אפשר להבין את התמונה הגדולה. ספרי במילים
          שלך: מה קורה בקטע? מי? מה? למה?
        </p>
        <FieldArea
          label="הקטע במילים שלי"
          value={answers["decode:retell"] ?? ""}
          onChange={(v) => setAnswer("decode:retell", v)}
          readOnly={readOnly}
          rows={5}
        />
      </StageCard>
    ),
  };

  return (
    <div>
      {/* the interactive passage — always visible during decoding */}
      <InteractivePassage
        passage={passage}
        markOf={markOf}
        setMenu={setMenu}
        readOnly={readOnly}
      />
      <div className="mt-6">{stageBody[stage]}</div>
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() =>
            askClaude(
              `שלב ${stage} (${DECODE_STAGES[stage - 1].title}) בפענוח ${passage.ref}.`,
              "אני צריכה עזרה בשלב הזה"
            )
          }
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
        >
          ✨ אני תקועה — עזרה קטנה
        </button>
        <button
          onClick={advanceStage}
          className="rounded-full bg-[color:var(--accent)] px-8 py-2.5 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
        >
          {stage === 7 ? "לשאלות ההבנה ←" : "סיימתי את השלב ←"}
        </button>
      </div>
    </div>
  );
}

// =============================================================================
// Interactive passage — every word is tappable/clickable for marking.
// =============================================================================

function InteractivePassage({
  passage,
  markOf,
  setMenu,
  readOnly,
  compact,
}: {
  passage: PassageBlock;
  markOf: (p: string, i: number) => Marking[];
  setMenu: (m: { passageKey: string; wordIndex: number; wordText: string; x: number; y: number } | null) => void;
  readOnly: boolean;
  compact?: boolean;
}) {
  let wordIndex = -1;
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-5 sm:p-7">
      <p className="mb-3 flex items-center justify-between gap-2 text-xs font-bold tracking-wide text-[color:var(--accent)]">
        <span>📖 {passage.ref}</span>
        {passage.sefariaRef && (
          <a
            href={`https://www.sefaria.org.il/${passage.sefariaRef}?lang=he`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-[color:var(--border)] px-2.5 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]/60 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            לקריאה בספריא ↗
          </a>
        )}
      </p>
      <div
        className={[
          "leading-[2.3] text-[color:var(--foreground)]",
          compact ? "text-[17px]" : "text-[19px] sm:text-[21px]",
        ].join(" ")}
        style={{ textAlign: "justify", textAlignLast: "right" }}
      >
        {passage.verses.map((verse) => (
          <span key={verse.num}>
            <span className="me-1 select-none text-[12px] text-[color:var(--primary)]/40">
              ({verse.num})
            </span>
            {verse.text.split(/\s+/).map((word, wi) => {
              wordIndex += 1;
              const idx = wordIndex;
              const marks = markOf(passage.key, idx);
              const primary = marks[0];
              const st = primary ? MARK_STYLE[primary.kind] : null;
              return (
                <span key={`${verse.num}-${wi}`}>
                  <span
                    role="button"
                    tabIndex={readOnly ? -1 : 0}
                    onClick={(e) => {
                      if (readOnly) return;
                      e.stopPropagation();
                      const rect = (e.target as HTMLElement).getBoundingClientRect();
                      setMenu({
                        passageKey: passage.key,
                        wordIndex: idx,
                        wordText: word.replace(/[:،.]/g, ""),
                        x: rect.left,
                        y: rect.bottom,
                      });
                    }}
                    className={[
                      "cursor-pointer rounded px-0.5 transition",
                      readOnly ? "cursor-default" : "hover:bg-[color:var(--accent)]/15",
                    ].join(" ")}
                    style={
                      st
                        ? {
                            background: st.bg,
                            borderBottom: `2px ${primary!.kind === "hard" ? "dashed" : "solid"} ${st.border}`,
                          }
                        : undefined
                    }
                    title={marks.map((m) => MARK_STYLE[m.kind].label).join(" + ") || undefined}
                  >
                    {word}
                  </span>{" "}
                </span>
              );
            })}
          </span>
        ))}
      </div>
      {!readOnly && (
        <p className="mt-3 text-[11px] text-[color:var(--primary)]/45">
          💡 לחצי על כל מילה כדי לסמן: 📌 מילה מנחה · 🤔 מילה קשה · ❓ שאלה — או לבקש עזרה מקלוד
        </p>
      )}
    </div>
  );
}

// =============================================================================
// Worksheet blocks (stage 8)
// =============================================================================

const ICON_MAP = {
  thinking: { emoji: "💡", color: "#b3892b" },
  argument: { emoji: "⚖️", color: "#413055" },
  reading: { emoji: "📖", color: "#3e6b4f" },
  leadership: { emoji: "👑", color: "#9d3438" },
} as const;

function BlockView({
  block,
  answers,
  setAnswer,
  markOf,
  setMenu,
  readOnly,
  askClaude,
}: {
  block: TaskBlock;
  answers: Record<string, string>;
  setAnswer: (k: string, v: string) => void;
  markOf: (p: string, i: number) => Marking[];
  setMenu: (m: { passageKey: string; wordIndex: number; wordText: string; x: number; y: number } | null) => void;
  readOnly: boolean;
  askClaude: (context: string, input: string) => void;
}) {
  if (block.type === "intro") {
    return (
      <p className="text-sm leading-7 text-[color:var(--foreground)]/80">{block.body}</p>
    );
  }
  if (block.type === "passage") {
    return (
      <InteractivePassage
        passage={block}
        markOf={markOf}
        setMenu={setMenu}
        readOnly={readOnly}
        compact
      />
    );
  }
  if (block.type === "source") {
    return (
      <div className="rounded-2xl border-s-4 border-[color:var(--accent)] bg-[color:var(--card)] p-5 shadow-sm">
        <p className="mb-2 flex items-center justify-between gap-2 text-sm font-bold text-[color:var(--accent)]">
          <span>📜 {block.title}</span>
          {block.sefariaRef && (
            <a
              href={`https://www.sefaria.org.il/${block.sefariaRef}?lang=he`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-[color:var(--border)] px-2.5 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]/60 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
            >
              המקור המלא בספריא ↗
            </a>
          )}
        </p>
        <p className="text-[15px] leading-8 text-[color:var(--foreground)]/85" style={{ fontStyle: "italic" }}>
          {block.text}
        </p>
        {!readOnly && (
          <button
            onClick={() =>
              askClaude(`התלמידה קוראת את המקור: ${block.title} — ${block.text.slice(0, 200)}`, "לא הבנתי את המקור הזה")
            }
            className="mt-2 text-[11px] text-[color:var(--accent)] underline-offset-2 hover:underline"
          >
            ✨ לא הבנתי את המקור — עזרה
          </button>
        )}
      </div>
    );
  }
  if (block.type === "case") {
    return (
      <div className="rounded-2xl border-2 border-dashed border-[color:var(--warning)]/50 bg-[color:var(--warning)]/5 p-5">
        <p className="mb-2 text-sm font-bold text-[color:var(--warning)]">🏫 {block.title}</p>
        <p className="whitespace-pre-wrap text-sm leading-7 text-[color:var(--foreground)]/85">
          {block.body}
        </p>
      </div>
    );
  }
  // question
  const q = block as QuestionBlock;
  const icon = ICON_MAP[q.icon];
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
      <p className="mb-1 flex items-center gap-2 text-[11px] font-bold tracking-wide" style={{ color: icon.color }}>
        <span className="text-sm">{icon.emoji}</span> {q.label}
      </p>
      <p className="mb-3 text-[15px] font-medium leading-7 text-[color:var(--foreground)]">
        {q.prompt}
      </p>
      {q.helper && (
        <p className="mb-2 -mt-1 text-xs text-[color:var(--primary)]/55">💡 {q.helper}</p>
      )}
      {q.fields ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {q.fields.map((f) => (
            <FieldArea
              key={f.key}
              label={f.label}
              value={answers[`${q.key}:${f.key}`] ?? ""}
              onChange={(v) => setAnswer(`${q.key}:${f.key}`, v)}
              readOnly={readOnly}
              rows={2}
            />
          ))}
        </div>
      ) : (
        <FieldArea
          label=""
          value={answers[q.key] ?? ""}
          onChange={(v) => setAnswer(q.key, v)}
          readOnly={readOnly}
        />
      )}
      {!readOnly && (
        <button
          onClick={() =>
            askClaude(
              `שאלה במשימה [${q.label}]: ${q.prompt}. מה שהתלמידה כתבה עד כה: ${answers[q.key] ?? "(כלום)"}`,
              "אני לא בטוחה איך לגשת לשאלה"
            )
          }
          className="mt-2 text-[11px] text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          ✨ תקועה? עזרה קטנה מקלוד
        </button>
      )}
    </div>
  );
}

function StageCard({
  emoji,
  title,
  children,
}: {
  emoji: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
      <p className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-[color:var(--primary)]">
        <span className="text-xl">{emoji}</span> {title}
      </p>
      {children}
    </div>
  );
}

function FieldArea({
  label,
  value,
  onChange,
  readOnly,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly: boolean;
  rows?: number;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
          {label}
        </span>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        rows={rows}
        placeholder="כתבי כאן..."
        className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-[color:var(--accent)] read-only:bg-[color:var(--background)] read-only:text-[color:var(--foreground)]/70"
      />
    </label>
  );
}

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
