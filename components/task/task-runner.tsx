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

interface WordMenuState {
  passageKey: string;
  wordIndex: number;
  wordText: string;
  verseNum: string;
  verseText: string;
  passageRef: string;
  x: number;
  y: number;
}

interface Props {
  taskId: number;
  studentName?: string | null;
  content: TaskContent;
  mainPassage: PassageBlock;
  initialAnswers: Record<string, string>;
  initialMarkings: Marking[];
  initialQuestions?: string[];
  canReset?: boolean;
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
  studentName,
  content,
  mainPassage,
  initialAnswers,
  initialMarkings,
  initialQuestions,
  canReset,
  initialStage,
  initialWorkSeconds,
  submitted: initialSubmitted,
  dueAt,
  totalUnits,
}: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [markings, setMarkings] = useState<Marking[]>(initialMarkings);
  // Stages 1-7 = Part A (pshat decoding); stage 8 = Part B (העמקה ודיון).
  const [stage, setStage] = useState(Math.min(Math.max(initialStage, 1), 8));
  // Highest stage ever reached — navigating back never re-locks later stages.
  const [maxStage, setMaxStage] = useState(Math.min(Math.max(initialStage, 1), 8));
  const [submitted, setSubmitted] = useState(initialSubmitted);
  const [workSeconds, setWorkSeconds] = useState(initialWorkSeconds);
  const [clock, setClock] = useState("");
  const [menu, setMenu] = useState<WordMenuState | null>(null);
  // Question composer — ask about a word, part of a verse, or a whole verse,
  // from ANY stage. Saved straight into the personal question bank.
  const [qComposer, setQComposer] = useState<{
    sourceRef: string;
    contextLabel: string;
  } | null>(null);
  const [qComposerDraft, setQComposerDraft] = useState("");
  // The composer card can be dragged away (e.g. to peek at the passage while
  // phrasing the question). null = default centered/bottom-sheet position.
  const [qPos, setQPos] = useState<{ x: number; y: number } | null>(null);
  const qDrag = useRef<{ dx: number; dy: number } | null>(null);
  const qCardRef = useRef<HTMLDivElement | null>(null);
  // Claude assist — a real conversation: the student can reply and be guided
  // step by step ("אני עשיתי לבד אבל לא פגשתי קיר"). The panel opens next to
  // the word that triggered it (that's where the eye is) and can be dragged
  // anywhere afterwards.
  const [assist, setAssist] = useState<{
    context: string;
    kind?: string;
    word?: string;
    messages: { role: "user" | "assistant"; content: string }[];
    loading: boolean;
  } | null>(null);
  const [assistDraft, setAssistDraft] = useState("");
  const [assistPos, setAssistPos] = useState<{ x: number; y: number } | null>(null);
  const assistDrag = useRef<{ dx: number; dy: number } | null>(null);

  const clampAssistPos = (x: number, y: number) => {
    const w = typeof window !== "undefined" ? window.innerWidth : 1000;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const panelW = Math.min(430, w - 16);
    return {
      x: Math.max(8, Math.min(x, w - panelW - 8)),
      y: Math.max(8, Math.min(y, h - 220)),
    };
  };

  const onAssistDragStart = (e: React.PointerEvent) => {
    if (!assistPos) return;
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fine without capture
    }
    assistDrag.current = { dx: e.clientX - assistPos.x, dy: e.clientY - assistPos.y };
  };
  const onAssistDragMove = (e: React.PointerEvent) => {
    if (!assistDrag.current) return;
    setAssistPos(
      clampAssistPos(e.clientX - assistDrag.current.dx, e.clientY - assistDrag.current.dy)
    );
  };
  const onAssistDragEnd = () => {
    assistDrag.current = null;
  };
  const [questionDraft, setQuestionDraft] = useState("");
  const [banked, setBanked] = useState<string[]>(initialQuestions ?? []);
  const readOnly = submitted;
  // How to label the student's own messages in the assist chat — first name
  // when we have it, otherwise the dual form (never a gendered guess).
  const meLabel = (studentName ?? "").trim().split(/\s+/)[0] || "את/ה";

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
    for (const c of content.comprehension) {
      if ((answers[`comp:${c.key}`] ?? "").trim().length >= 2) n += 1;
    }
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

  const postMarking = (
    passageKey: string,
    wordIndex: number,
    wordText: string,
    kind: string,
    remove: boolean
  ) => {
    fetch(`/api/tasks/${taskId}/markings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passageKey, wordIndex, wordText, kind, remove }),
    }).catch(() => {});
  };

  const toggleMark = (kind: MarkKind) => {
    if (!menu || readOnly) return;
    const { passageKey, wordIndex, wordText } = menu;
    const existing = markings.find(
      (m) => m.passageKey === passageKey && m.wordIndex === wordIndex && m.kind === kind
    );
    const remove = Boolean(existing);

    // מילה מנחה and מילה קשה are mutually exclusive — picking one replaces
    // the other (so re-marking actually CHANGES the word's marking).
    const opposite = kind === "leitwort" ? "hard" : kind === "hard" ? "leitwort" : null;
    const oppositeExisting = opposite
      ? markings.find(
          (m) =>
            m.passageKey === passageKey && m.wordIndex === wordIndex && m.kind === opposite
        )
      : null;

    setMarkings((ms) => {
      let next = ms;
      if (oppositeExisting && !remove) next = next.filter((m) => m !== oppositeExisting);
      return remove
        ? next.filter((m) => m !== existing)
        : [...next, { passageKey, wordIndex, wordText, kind }];
    });
    if (oppositeExisting && !remove) {
      postMarking(passageKey, wordIndex, wordText, opposite!, true);
    }
    postMarking(passageKey, wordIndex, wordText, kind, remove);

    // Iron rule in action: marking a leitwort — at ANY stage — triggers
    // immediate formative feedback: affirming why a right choice works and
    // inviting deeper looking, or guiding self-discovery when it doesn't.
    if (kind === "leitwort" && !remove) {
      askClaude(`בדיקת סימון מילה מנחה — המילה ״${wordText}״`, "", {
        kind: "leitwort",
        word: wordText,
        anchor: { x: menu.x, y: menu.y },
      });
    }
    setMenu(null);
  };

  // Remove every marking from a word — one tap, no hunting.
  const clearWordMarks = () => {
    if (!menu || readOnly) return;
    const { passageKey, wordIndex, wordText } = menu;
    const existing = markings.filter(
      (m) => m.passageKey === passageKey && m.wordIndex === wordIndex
    );
    setMarkings((ms) =>
      ms.filter((m) => !(m.passageKey === passageKey && m.wordIndex === wordIndex))
    );
    for (const m of existing) {
      postMarking(passageKey, wordIndex, wordText, m.kind, true);
    }
    setMenu(null);
  };

  const saveComposerQuestion = () => {
    if (!qComposer || !qComposerDraft.trim()) return;
    bankQuestion(qComposerDraft, qComposer.sourceRef);
    setQComposer(null);
  };

  // "שאלה על הקטע" — the bubble that grows out of the passage box itself.
  const openPassageQuestion = (ref: string) => {
    if (readOnly) return;
    setQComposer({
      sourceRef: ref,
      contextLabel: `שאלה על ${ref} — מילה, חלק מפסוק או פסוק שלם`,
    });
    setQComposerDraft("");
    setQPos(null);
  };

  const onQDragStart = (e: React.PointerEvent) => {
    const card = qCardRef.current;
    if (!card) return;
    const r = card.getBoundingClientRect();
    setQPos({ x: r.left, y: r.top });
    qDrag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // fine without capture
    }
  };
  const onQDragMove = (e: React.PointerEvent) => {
    if (!qDrag.current) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const cardW = Math.min(448, w - 16);
    setQPos({
      x: Math.max(8, Math.min(e.clientX - qDrag.current.dx, w - cardW - 8)),
      y: Math.max(8, Math.min(e.clientY - qDrag.current.dy, h - 180)),
    });
  };
  const onQDragEnd = () => {
    qDrag.current = null;
  };

  // ---------- question bank ----------
  const bankQuestion = (question: string, sourceRef?: string) => {
    const q = question.trim();
    if (!q) return;
    setBanked((b) => [...b, q]);
    setQuestionDraft("");
    // The question stage requires at least one question formulated IN it.
    if (stage === 5) setAnswer("decode:q5-added", "yes");
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
    opts?: { kind?: string; word?: string; anchor?: { x: number; y: number } }
  ) => {
    if (opts?.anchor) {
      setAssistPos(clampAssistPos(opts.anchor.x - 120, opts.anchor.y + 14));
    } else if (!assist) {
      setAssistPos(null); // default bottom sheet
    }
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
          { role: "assistant", content: "משהו השתבש בחיבור — נסו שוב עוד רגע." },
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

  // Teacher tool: wipe own progress on this task to re-experience it from
  // scratch in student mode (server enforces teacher-only).
  const [resetBusy, setResetBusy] = useState(false);
  const resetTask = async () => {
    if (
      !window.confirm(
        "לאפס את המשימה? כל התשובות, הסימונים והשאלות שלך במשימה הזו יימחקו ותתחילו מהשלב הראשון."
      )
    )
      return;
    setResetBusy(true);
    try {
      await fetch(`/api/tasks/${taskId}/reset`, { method: "POST" });
      window.location.reload();
    } catch {
      setResetBusy(false);
    }
  };

  const advanceStage = () => {
    const next = Math.min(stage + 1, 8);
    setStage(next);
    setMaxStage((m) => Math.max(m, next));
    saveState(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const overdue = Date.now() / 1000 > dueAt && !submitted;

  return (
    <div className="mx-auto w-full max-w-3xl" onClick={() => setMenu(null)}>
      {/* ===== sticky status bar: labeled clock, work stopwatch, progress ===== */}
      <div
        className="sticky top-[57px] z-20 -mx-2 mb-6 rounded-b-xl border-b border-x border-[color:var(--border)] px-4 py-2"
        style={{ backgroundColor: "var(--card)" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="text-center" title="השעה עכשיו בישראל">
              <p className="tabular-nums text-base font-bold leading-5 text-[color:var(--primary)]/70">
                🕐 {clock.slice(0, 5)}
              </p>
              <p className="text-[10px] leading-3 text-[color:var(--primary)]/50">
                השעה עכשיו
              </p>
            </div>
            <div
              className="text-center"
              title="רץ רק כשאתם באמת כאן — נעצר כשעוזבים את החלון"
            >
              <p className="tabular-nums text-base font-bold leading-5 text-[color:var(--accent)]">
                ⏱ {formatTimer(workSeconds)}
              </p>
              <p className="text-[10px] leading-3 text-[color:var(--primary)]/50">
                זמן העבודה שלי
              </p>
            </div>
          </div>
          <div className="max-w-[45%] flex-1" title="כמה מהמשימה כבר עשיתי">
            <div className="flex items-center gap-2">
              <div className="h-3 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]/50">
                <div
                  className="h-full rounded-full bg-gradient-to-l from-[color:var(--accent)] to-[color:var(--primary)] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="whitespace-nowrap text-base font-bold text-[color:var(--primary)]">
                {progressPct}%
              </span>
            </div>
            <p className="text-center text-[10px] leading-3 text-[color:var(--primary)]/50">
              ההתקדמות שלי במשימה
            </p>
          </div>
        </div>
      </div>

      {submitted && (
        <div className="mb-6 rounded-xl border border-[color:var(--success)]/40 bg-[color:var(--success)]/10 px-4 py-3 text-sm text-[color:var(--success)]">
          ✅ המשימה הוגשה! עכשיו רגע קטן לעצמך — פתחו את לשונית 🪞 הרפלקציה שבצד וספרו איך היה. {Date.now() / 1000 <= dueAt && "אפשר לבטל את ההגשה ולתקן עד המועד האחרון."}
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

      {/* ===== two-part progress rail: each part is its own visual block ===== */}
      {canReset && (
        <div className="mb-2 flex justify-end">
          <button
            onClick={resetTask}
            disabled={resetBusy}
            className="rounded-full border border-dashed border-[color:var(--danger)]/40 px-3 py-1 text-[11px] font-semibold text-[color:var(--danger)]/80 transition hover:bg-[color:var(--danger)]/5 disabled:opacity-40"
            title="מוחק את ההתקדמות שלך בלבד — כלי מורה"
          >
            {resetBusy ? "מאפס..." : "🔄 איפוס המשימה (כלי מורה)"}
          </button>
        </div>
      )}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {/* Part A block */}
        <div
          className={[
            "flex-1 rounded-2xl border-2 p-3.5 transition",
            stage <= 7
              ? "border-[color:var(--primary)]/40 bg-[color:var(--primary)]/[0.045] shadow-sm"
              : "border-[color:var(--border)] bg-[color:var(--card)] opacity-75",
          ].join(" ")}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--primary)] px-2.5 py-0.5 text-[11px] font-bold text-white">
              חלק א
            </span>
            <span className="font-display text-sm font-bold text-[color:var(--primary)]">
              קריאת פשט ושאלת שאלות
            </span>
            {stage <= 7 && (
              <span className="rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--success)]">
                אתם כאן · שלב {stage} מתוך 7
              </span>
            )}
          </div>
          <p className="mb-2.5 text-[11px] text-[color:var(--primary)]/60">
            💪 המיומנות: פענוח הטקסט על דרך הפשט + ניסוח שאלות
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {DECODE_STAGES.map((s) => (
              <button
                key={s.n}
                onClick={() => s.n <= maxStage && setStage(s.n)}
                disabled={s.n > maxStage}
                className={[
                  "rounded-full px-3 py-1 text-xs font-semibold transition",
                  s.n === stage
                    ? "bg-[color:var(--primary)] text-white shadow"
                    : s.n < Math.max(stage, maxStage) || maxStage === 8
                      ? "bg-[color:var(--success)]/15 text-[color:var(--success)] hover:bg-[color:var(--success)]/25"
                      : "border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--primary)]/40",
                ].join(" ")}
              >
                {s.n < maxStage ? "✓ " : ""}
                {s.n} · {s.title}
              </button>
            ))}
          </div>
        </div>
        {/* connector: forward is left in RTL */}
        <div
          className="hidden items-center text-xl font-bold text-[color:var(--accent)]/60 sm:flex"
          aria-hidden
        >
          ←
        </div>
        {/* Part B block */}
        <div
          className={[
            "rounded-2xl border-2 p-3.5 transition sm:w-64",
            stage === 8
              ? "border-[color:var(--accent)] bg-[color:var(--accent)]/[0.06] shadow-sm"
              : maxStage >= 8
                ? "border-[color:var(--border)] bg-[color:var(--card)]"
                : "border-dashed border-[color:var(--border)] bg-[color:var(--card)]/60",
          ].join(" ")}
        >
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--accent)] px-2.5 py-0.5 text-[11px] font-bold text-white">
              חלק ב
            </span>
            <span className="font-display text-sm font-bold text-[color:var(--primary)]">
              העמקה ודיון
            </span>
            {stage === 8 && (
              <span className="rounded-full bg-[color:var(--success)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--success)]">
                אתם כאן
              </span>
            )}
          </div>
          <p className="mb-2.5 text-[11px] text-[color:var(--primary)]/60">
            💪 המיומנות: כתיבה טיעונית — טענה, נימוק וביסוס
          </p>
          <button
            onClick={() => maxStage >= 8 && setStage(8)}
            disabled={maxStage < 8}
            className={[
              "rounded-full px-4 py-1 text-xs font-bold transition",
              stage === 8
                ? "bg-[color:var(--accent)] text-white shadow"
                : maxStage >= 8
                  ? "border border-[color:var(--accent)]/60 text-[color:var(--accent)] hover:bg-[color:var(--accent)]/10"
                  : "border border-[color:var(--border)] text-[color:var(--primary)]/35",
            ].join(" ")}
          >
            {maxStage >= 8 ? "כניסה לחלק ב" : "🔒 נפתח בסיום חלק א"}
          </button>
        </div>
      </div>
      {stage <= 7 && (
        <p className="mb-6 text-xs text-[color:var(--accent)]">
          🎯 למה השלב הזה? <b>{DECODE_STAGES[stage - 1].why}</b>
        </p>
      )}

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
          onAskQuestion={openPassageQuestion}
        />
      )}

      {/* ===== Part B (stage 8): the worksheet ===== */}
      {stage === 8 && (
        <div className="space-y-10">
          <div className="rounded-2xl border-2 border-[color:var(--primary)]/25 bg-[color:var(--card)] p-6 text-center">
            <p className="mb-1 text-[11px] font-semibold tracking-[0.3em] text-[color:var(--accent)]">
              חלק ב
            </p>
            <h2 className="font-display text-2xl font-extrabold text-[color:var(--primary)]">
              העמקה ודיון — כתיבה טיעונית
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--foreground)]/70">
              סיימתם את קריאת הפשט 👏 עכשיו מעמיקים בטקסט ובמקורות, ומתרגלים את
              המיומנות השנייה: טענה, נימוק וביסוס מן הכתובים.
            </p>
          </div>
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
                    onAskQuestion={openPassageQuestion}
                  />
                ))}
              </div>
            </section>
          ))}

          {/* submit */}
          {!submitted && (
            <div className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-6 text-center">
              <p className="mb-1 font-display text-lg font-bold text-[color:var(--primary)]">
                מסיימים? זמן להגיש 🎉
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
                {submitBusy ? "שולחים..." : "הגשת המשימה ✨"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===== word marking menu ===== */}
      {menu && !readOnly && (
        <div
          className="fixed z-50 rounded-xl border border-[color:var(--border)] p-2 shadow-xl"
          style={{
            backgroundColor: "var(--card)",
            left: Math.min(menu.x, typeof window !== "undefined" ? window.innerWidth - 250 : menu.x),
            top: menu.y + 8,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
            <p className="text-[11px] text-[color:var(--primary)]/60">
              המילה: <b className="text-[color:var(--primary)]">{menu.wordText}</b>
            </p>
            <button
              onClick={() => setMenu(null)}
              aria-label="סגירה"
              className="rounded-md px-1 text-sm leading-none text-[color:var(--primary)]/45 hover:bg-[color:var(--primary)]/5"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(["leitwort", "hard"] as MarkKind[]).map((kind) => {
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
                  className="whitespace-nowrap rounded-full border px-2.5 py-1.5 text-[11px] font-semibold transition"
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
          {markings.some(
            (m) => m.passageKey === menu.passageKey && m.wordIndex === menu.wordIndex
          ) && (
            <button
              onClick={clearWordMarks}
              className="mt-1.5 w-full whitespace-nowrap rounded-lg px-2 py-1 text-[11px] font-semibold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/5"
            >
              🧽 הסרת כל הסימונים מהמילה
            </button>
          )}
          <button
            onClick={() => {
              askClaude(
                `בקשת עזרה על המילה ״${menu.wordText}״ בקטע ${content.bookRef}, פסוק ${menu.verseNum}. שלב נוכחי: ${DECODE_STAGES[stage - 1].title}. זכרו: רמז מדורג, לא פירוש מלא מיד.`,
                `לא ברורה לי המילה ״${menu.wordText}״`,
                { anchor: { x: menu.x, y: menu.y } }
              );
              setMenu(null);
            }}
            className="mt-1.5 w-full rounded-lg bg-[color:var(--primary)]/5 px-2 py-1 text-[11px] text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10"
          >
            ✨ עזרה מקלוד על המילה הזו
          </button>
        </div>
      )}


      {/* ===== question composer — word / verse, any stage ===== */}
      {qComposer && !readOnly && (
        <div
          className={
            qPos
              ? "pointer-events-none fixed inset-0 z-50"
              : "fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
          }
          onClick={qPos ? undefined : () => setQComposer(null)}
        >
          <div
            ref={qCardRef}
            className="pointer-events-auto w-full max-w-md rounded-t-2xl p-5 shadow-2xl sm:rounded-2xl"
            style={
              qPos
                ? {
                    position: "fixed",
                    left: qPos.x,
                    top: qPos.y,
                    width: "min(448px, calc(100vw - 16px))",
                    backgroundColor: "var(--card)",
                  }
                : { backgroundColor: "var(--card)" }
            }
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="mb-1 flex cursor-move items-start justify-between gap-2"
              style={{ touchAction: "none" }}
              onPointerDown={onQDragStart}
              onPointerMove={onQDragMove}
              onPointerUp={onQDragEnd}
              onPointerCancel={onQDragEnd}
            >
              <p className="font-display text-base font-bold text-[color:var(--primary)]">
                ❓ {qComposer.contextLabel}
              </p>
              <button
                onClick={() => setQComposer(null)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="סגירת חלונית השאלה"
                className="-mt-1 rounded-full px-1.5 py-0.5 text-base leading-none text-[color:var(--primary)]/50 transition hover:text-[color:var(--primary)]"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-[11px] text-[color:var(--primary)]/55">
              השאלה נכנסת למאגר השאלות האישי — ובסוף השנה בוחרים ממנו שאלה אחת
              לעבודה אישית 🌟
            </p>
            <textarea
              value={qComposerDraft}
              onChange={(e) => setQComposerDraft(e.target.value)}
              rows={3}
              autoFocus
              placeholder="מה השאלה? (למשל: למה הפסוק חוזר על... / מה מוזר כאן...)"
              className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setQComposer(null)}
                className="rounded-full px-4 py-1.5 text-xs text-[color:var(--primary)]/60"
              >
                ביטול
              </button>
              <button
                onClick={saveComposerQuestion}
                disabled={!qComposerDraft.trim()}
                className="rounded-full bg-[color:var(--primary)] px-5 py-1.5 text-xs font-bold text-white disabled:opacity-40"
              >
                שמירה למאגר 💾
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Claude assist panel — opens NEXT TO the word, draggable ===== */}
      {assist && (
        <div
          className="fixed z-40 rounded-2xl border border-[color:var(--primary)]/20 p-4 shadow-2xl"
          style={
            assistPos
              ? {
                  left: assistPos.x,
                  top: assistPos.y,
                  width: "min(430px, calc(100vw - 16px))",
                  backgroundColor: "var(--card)",
                }
              : {
                  bottom: 16,
                  left: 16,
                  right: 16,
                  marginInline: "auto",
                  maxWidth: "32rem",
                  backgroundColor: "var(--card)",
                }
          }
        >
          <div
            className="mb-2 flex items-center justify-between"
            onPointerDown={onAssistDragStart}
            onPointerMove={onAssistDragMove}
            onPointerUp={onAssistDragEnd}
            style={{ cursor: assistPos ? "grab" : "default", touchAction: "none" }}
            title={assistPos ? "אפשר לגרור אותי לכל מקום" : undefined}
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--primary)]">
                <span className="text-sm">✨</span>
              </div>
              <p className="text-[10px] text-[color:var(--primary)]/45">
                קלוד רומז ומכוון — לא פותר במקומך 💪 אפשר לענות לו
                {assistPos ? " ולגרור אותי" : ""}!
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
                {m.role === "user" && <b className="me-1 text-[color:var(--accent)]">{meLabel}:</b>}
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
            <div className="mt-2 flex items-end gap-2">
              <textarea
                value={assistDraft}
                onChange={(e) => setAssistDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter makes a new line (students write
                  // multi-line questions here).
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    replyToClaude();
                  }
                }}
                rows={Math.min(4, Math.max(1, assistDraft.split("\n").length))}
                placeholder="תשובה לקלוד... (שיפט+אנטר לשורה חדשה)"
                className="flex-1 resize-none rounded-2xl border border-[color:var(--border)] bg-white px-3.5 py-1.5 text-xs leading-5 outline-none focus:border-[color:var(--accent)]"
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
  setMenu: (m: WordMenuState | null) => void;
  readOnly: boolean;
  questionDraft: string;
  setQuestionDraft: (v: string) => void;
  bankQuestion: (q: string, ref?: string) => void;
  banked: string[];
  askClaude: (context: string, input: string, opts?: { kind?: string }) => void;
  advanceStage: () => void;
  onAskQuestion: (ref: string) => void;
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
    onAskQuestion,
  } = props;

  const leitworts = markings.filter((m) => m.passageKey === passage.key && m.kind === "leitwort");
  const hards = markings.filter((m) => m.passageKey === passage.key && m.kind === "hard");
  const decodeCfg = content.decode;

  // ---- per-stage gates: what MUST be filled before advancing ----
  // Stage 2: at least one leitwort marked + a written insight, OR an explicit
  // (Claude-checked) "no leitwort in this passage" claim.
  const leitwortInsight = (answers["decode:leitwort-why"] ?? "").trim();
  const noLeitwortClaim = answers["decode:no-leitwort"] === "yes";
  const stage2Blocked =
    stage === 2 &&
    !noLeitwortClaim &&
    (leitworts.length === 0 || leitwortInsight.length < 10);

  // Stage 4 (genre): must pick a genre AND explain what gave it away.
  // Parallelism is a genre tool — opens only for poetry/speech (or when the
  // task declares the passage has one).
  const chosenGenre = (answers["decode:genre"] ?? "").trim();
  const genreWhy = (answers["decode:genre-help"] ?? "").trim();
  const parallelismOpen =
    chosenGenre === "שירה" || chosenGenre === "נאום" || decodeCfg.hasParallelism;
  const stage4Blocked = stage === 4 && (!chosenGenre || genreWhy.length < 5);

  // Stage 5: at least one ADDITIONAL question formulated here — unless the
  // student already has 3+ banked and ticks "no further question right now".
  const q5Added = answers["decode:q5-added"] === "yes";
  const q5Enough = answers["decode:q5-enough"] === "yes" && banked.length >= 3;
  const stage5Blocked = stage === 5 && !q5Added && !q5Enough;

  // Stage 6: the retelling is mandatory and gets feedback.
  const retell = (answers["decode:retell"] ?? "").trim();
  const stage6Blocked = stage === 6 && retell.length < 10;

  // Stage 7: both simple comprehension answers required to enter Part B.
  const stage7Blocked =
    stage === 7 &&
    content.comprehension.some(
      (c) => (answers[`comp:${c.key}`] ?? "").trim().length < 2
    );

  const blocked =
    stage2Blocked || stage4Blocked || stage5Blocked || stage6Blocked || stage7Blocked;
  const blockedHint =
    stage2Blocked
      ? leitworts.length === 0 && !noLeitwortClaim
        ? "כדי להמשיך: סמנו 📌 מילה מנחה בקטע וכתבו עליה תובנה — או סמנו למטה שלדעתכם אין מילה מנחה"
        : "כדי להמשיך: כתבו למעלה את התובנה שלכם מהמילה המנחה — קלוד ייתן עליה משוב 🌱"
      : stage4Blocked
        ? "כדי להמשיך: בחרו סוגה וכתבו לפי מה זיהיתם אותה"
        : stage5Blocked
          ? "כדי להמשיך: נסחו לפחות שאלה אחת נוספת ושמרו אותה למאגר"
          : stage6Blocked
            ? "כדי להמשיך: ספרו את הקטע במילים שלכם — קלוד ייתן משוב 🌱"
            : stage7Blocked
              ? "כדי לעבור לחלק ב: ענו על שתי שאלות ההבנה"
              : "";

  const finishStage = () => {
    if (blocked) return;
    if (stage === 2) {
      if (noLeitwortClaim) {
        askClaude(
          `בשלב המילה המנחה בקטע ${passage.ref} סומן: "לדעתי אין מילה מנחה בקטע". יש לבדוק את הטענה ברצינות מול הקטע המלא: אם היא נכונה — לאשר ולהסביר; אם יש בקטע חזרה משמעותית — להוביל בשאלות לגילוי עצמי (למשל: אילו מילים חוזרות? כמה פעמים?) בלי לחשוף את המילה.`,
          "",
          { kind: "leitwort-insight" }
        );
      } else {
        askClaude(
          `משוב על תובנת המילה המנחה שנכתבה בשלב 2 בקטע ${passage.ref}. המילים שסומנו כמילה מנחה: ${
            leitworts.map((m) => `״${m.wordText}״`).join(", ") || "(לא סומנו מילים)"
          }. התובנה שנכתבה: ${leitwortInsight}`,
          "",
          { kind: "leitwort-insight" }
        );
      }
    }
    if (stage === 4) {
      const parallelism = (answers["decode:parallelism"] ?? "").trim();
      askClaude(
        `משוב על שלב הסוגה בקטע ${passage.ref}. הסוגה שנבחרה: ${chosenGenre}. מה שנכתב על הזיהוי: ${genreWhy}${
          parallelism ? `. מה שנכתב על תקבולת: ${parallelism}` : ""
        }`,
        "",
        { kind: "genre-insight" }
      );
    }
    if (stage === 6) {
      askClaude(
        `משוב על "הקטע במילים שלי" (שלב מבינים בכל זאת) בקטע ${passage.ref}. מה שנכתב: ${retell}`,
        "",
        { kind: "retell" }
      );
    }
    advanceStage();
  };

  const stageBody: Record<number, React.ReactNode> = {
    1: (
      <StageCard emoji="👋" title="קוראים פעם ראשונה — בלי לחץ">
        <p className="text-sm leading-7 text-[color:var(--foreground)]/75">
          קראו את הקטע בנחת. תוך כדי קריאה, לחצו על מילים שקשות לכם (סמנו 🤔), ואם משהו מעורר שאלה — לחצו על הבועית 💭 שמתחת לקטע. עוד לא מנתחים — רק פוגשים.
        </p>
      </StageCard>
    ),
    2: (
      <StageCard emoji="📌" title="מילה מנחה — המילה שחוזרת שוב ושוב">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          כשמילה (או משפחת מילים) חוזרת שוב ושוב בקטע — היא ״מילה מנחה״: מפתח
          שהתורה מניחה לנו לרעיון המרכזי. קראו שוב וסמנו 📌 את המילה שלדעתכם
          מנחה את הקטע — ואם כבר סימנתם אותה תוך כדי הקריאה הראשונה, מצוין,
          אין צורך לסמן שוב. החלק החדש של השלב הזה הוא התשובה שלמטה: להסביר
          במילים שלכם מה החזרה עושה לקטע. זו התובנה של השלב — בלעדיה לא
          ממשיכים, וקלוד ייתן עליה משוב.
        </p>
        {leitworts.length > 0 && (
          <p className="mb-2 text-xs text-[color:var(--primary)]/70">
            סימנתם: {leitworts.map((m) => `״${m.wordText}״`).join(", ")}
          </p>
        )}
        <FieldArea
          label="למה דווקא המילה הזו חוזרת? מה היא באה לומר על הקטע כולו?"
          value={answers["decode:leitwort-why"] ?? ""}
          onChange={(v) => setAnswer("decode:leitwort-why", v)}
          readOnly={readOnly}
        />
        <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[color:var(--primary)]/70">
          <input
            type="checkbox"
            checked={noLeitwortClaim}
            disabled={readOnly}
            onChange={(e) =>
              setAnswer("decode:no-leitwort", e.target.checked ? "yes" : "")
            }
            className="h-4 w-4 accent-[color:var(--primary)]"
          />
          חיפשתי ולדעתי אין מילה מנחה בקטע הזה (קלוד יבדוק את זה איתכם)
        </label>
      </StageCard>
    ),
    3: (
      <StageCard emoji="🤔" title="מילים קשות — לדעת מה אני לא יודעת">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          את רוב המילים הקשות כבר סימנתם 🤔 בקריאה הראשונה — השלב הזה הוא רק
          סריקה אחרונה להשלמה: עברו פעם אחת על הקטע ובדקו שלא פספסתם מילה
          שפירושה לא ברור. לסמן מילים קשות זה לא כישלון — זו התחלת ההבנה!
          ואם לא מצאתם מילים קשות חדשות — סיימתם כאן, אפשר להמשיך ישר לשלב 4.
        </p>
        {hards.length > 0 ? (
          <p className="text-xs text-[color:var(--primary)]/70">
            המילים שסימנתם: {hards.map((m) => `״${m.wordText}״`).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-[color:var(--primary)]/50">
            עוד לא סימנתם מילים קשות. אם באמת הכול מובן — מצוין, אפשר להמשיך!
          </p>
        )}
      </StageCard>
    ),
    4: (
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
          label="לפי מה זיהיתם? כתבו מה בקטע הסגיר לכם את הסוגה — קלוד ייתן משוב גם על זה"
          value={answers["decode:genre-help"] ?? ""}
          onChange={(v) => setAnswer("decode:genre-help", v)}
          readOnly={readOnly}
        />
        {parallelismOpen ? (
          <div className="mt-4 rounded-xl border border-[color:var(--accent)]/30 bg-[color:var(--accent)]/[0.04] p-4">
            <p className="mb-2 font-display text-sm font-bold text-[color:var(--primary)]">
              🪞 נפתח כלי חדש: תקבולת — המקרא מסביר את עצמו
            </p>
            <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
              {decodeCfg.hasParallelism || chosenGenre === "שירה"
                ? "בסוגה הזאת פסוקים רבים בנויים משתי צלעות שאומרות רעיון דומה במילים שונות — זו ״תקבולת״. מצאו תקבולת אחת, ובדקו: האם הצלע המקבילה עוזרת להבין מילה קשה שסימנתם?"
                : "גם בנאום מופיעות לפעמים תקבולות — שתי צלעות שאומרות רעיון דומה במילים שונות. חפשו ביטויים שחוזרים במבנה דומה, ובדקו: האם הצלע המקבילה עוזרת להבין מילה קשה שסימנתם?"}
            </p>
            <FieldArea
              label="מה מצאתם? האם זה עזר להבין מילה קשה?"
              value={answers["decode:parallelism"] ?? ""}
              onChange={(v) => setAnswer("decode:parallelism", v)}
              readOnly={readOnly}
            />
          </div>
        ) : chosenGenre ? (
          <p className="mt-3 text-xs leading-5 text-[color:var(--primary)]/55">
            🪞 להכיר לדרך: יש כלי פענוח בשם ״תקבולת״ — שתי צלעות שאומרות רעיון
            דומה במילים שונות. הוא שייך בעיקר לשירה (ולפעמים לנאום), ולכן בסוגה
            שבחרתם אין שלב תקבולת. ניפגש איתו כשנגיע לקטעי שירה!
          </p>
        ) : null}
      </StageCard>
    ),
    5: (
      <StageCard emoji="❓" title="שאלת שאלות — כמה שיותר!">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          {banked.length > 0 ? (
            <>
              יפה — בדרך לכאן כבר נכנסו למאגר שלכם {banked.length === 1
                ? "שאלה אחת (למטה)"
                : `${banked.length} שאלות (למטה)`}. עכשיו, אחרי שכל הכלים עבדו,
              זה הרגע לעצור ולחפש שאלות <b>נוספות</b>: מה עדיין מפתיע? מה לא
              מסתדר? איזו שאלה חדשה נולדה דווקא בזכות מה שהבנתם בשלבים
              הקודמים? בסוף השנה תבחרו מהמאגר שאלה אחת לעבודה שלכם
              {banked.length < decodeCfg.minQuestions
                ? ` — נסו להגיע לפחות ל־${decodeCfg.minQuestions} שאלות בסך הכול.`
                : "."}
            </>
          ) : (
            <>
              השאלה היא לב הלימוד! אחרי שהכלים עבדו — אילו שאלות נשארו? מה
              מפתיע? מה לא מסתדר? כל שאלה נכנסת למאגר השאלות האישי שלכם, ובסוף
              השנה תבחרו מתוכו שאלה אחת לעבודה שלכם. נסו לנסח לפחות{" "}
              {decodeCfg.minQuestions} שאלות.
            </>
          )}
        </p>
        <div className="mb-2 flex items-end gap-2">
          <textarea
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                bankQuestion(questionDraft, passage.ref);
              }
            }}
            rows={Math.min(4, Math.max(1, questionDraft.split("\n").length))}
            disabled={readOnly}
            placeholder={
              banked.length > 0
                ? "כתבו שאלה נוספת... (אפשר להתחיל ב״למה דווקא...״)"
                : "כתבו שאלה... (אפשר להתחיל ב״למה דווקא...״)"
            }
            className="flex-1 resize-none rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
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
          <>
            <p className="mb-1 mt-3 text-[11px] font-semibold text-[color:var(--primary)]/60">
              השאלות שכבר במאגר שלכם:
            </p>
            <ul className="space-y-1">
              {banked.map((q, i) => (
                <li key={i} className="rounded-lg bg-[color:var(--primary)]/5 px-3 py-1.5 text-xs text-[color:var(--primary)]">
                  ❓ {q}
                </li>
              ))}
            </ul>
          </>
        )}
        <button
          onClick={() =>
            askClaude(
              `שלב שאלת שאלות על ${passage.ref}. קושי בניסוח שאלות. שאלות שכבר נשאלו: ${banked.join(" | ") || "(אין)"}`,
              "קשה לי לחשוב על שאלה"
            )
          }
          className="mt-2 text-xs text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          ✨ קשה לי לנסח שאלה — קלוד, עזור לי בקטנה
        </button>
        {banked.length >= 3 && !q5Added && (
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[color:var(--primary)]/70">
            <input
              type="checkbox"
              checked={answers["decode:q5-enough"] === "yes"}
              disabled={readOnly}
              onChange={(e) =>
                setAnswer("decode:q5-enough", e.target.checked ? "yes" : "")
              }
              className="h-4 w-4 accent-[color:var(--primary)]"
            />
            כבר ניסחתי {banked.length} שאלות — אין לי שאלה נוספת כרגע
          </label>
        )}
      </StageCard>
    ),
    6: (
      <StageCard emoji="💪" title="מבינים בכל זאת — גם בלי כל המילים">
        <p className="mb-3 text-sm leading-7 text-[color:var(--foreground)]/75">
          גם אם נשארו מילים לא פתורות — אפשר להבין את התמונה הגדולה. ספרו במילים
          שלכם: מה קורה בקטע? מי? מה? למה?
        </p>
        <FieldArea
          label="הקטע במילים שלי — קלוד ייתן משוב"
          value={answers["decode:retell"] ?? ""}
          onChange={(v) => setAnswer("decode:retell", v)}
          readOnly={readOnly}
          rows={5}
        />
      </StageCard>
    ),
    7: (
      <StageCard emoji="✅" title="בדיקת הבנה — שאלות פשוטות על הפשט">
        <p className="mb-4 text-sm leading-7 text-[color:var(--foreground)]/75">
          שתי שאלות קצרות, רק כדי לוודא שהסיפור עצמו ברור. עונים מתוך הקטע
          בלבד — בלי פרשנים ובלי העמקה. את ההעמקה שומרים לחלק ב!
        </p>
        <div className="space-y-4">
          {content.comprehension.map((c) => (
            <FieldArea
              key={c.key}
              label={c.prompt}
              value={answers[`comp:${c.key}`] ?? ""}
              onChange={(v) => setAnswer(`comp:${c.key}`, v)}
              readOnly={readOnly}
            />
          ))}
        </div>
      </StageCard>
    ),
  };

  return (
    <div>
      {/* instructions FIRST — so it's clear what to do before reading */}
      <div className="mb-5">{stageBody[stage]}</div>
      {/* the interactive passage — always visible during decoding */}
      <InteractivePassage
        passage={passage}
        markOf={markOf}
        setMenu={setMenu}
        readOnly={readOnly}
        onAskQuestion={onAskQuestion}
      />
      <div className="mt-6 flex items-center justify-between">
        <button
          onClick={() =>
            askClaude(
              `שלב ${stage} (${DECODE_STAGES[stage - 1].title}) בפענוח ${passage.ref}.`,
              "נתקעתי בשלב הזה — צריך עזרה קטנה"
            )
          }
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
        >
          ✨ נתקעתי — עזרה קטנה
        </button>
        <div className="flex flex-col items-end gap-1.5">
          <button
            onClick={finishStage}
            disabled={blocked}
            className="rounded-full bg-[color:var(--accent)] px-8 py-2.5 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
          >
            {stage === 7
              ? "סיימתי — לחלק ב ←"
              : stage === 6
                ? "לבדיקת ההבנה ←"
                : "סיימתי את השלב ←"}
          </button>
          {blocked && (
            <p className="max-w-xs text-end text-[11px] text-[color:var(--primary)]/55">
              {blockedHint}
            </p>
          )}
        </div>
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
  onAskQuestion,
}: {
  passage: PassageBlock;
  markOf: (p: string, i: number) => Marking[];
  setMenu: (m: WordMenuState | null) => void;
  readOnly: boolean;
  compact?: boolean;
  onAskQuestion?: (ref: string) => void;
}) {
  let wordIndex = -1;
  return (
    <div className="relative mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-5 sm:p-7">
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
                        verseNum: verse.num,
                        verseText: verse.text,
                        passageRef: passage.ref,
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
        <p className="mt-3 pb-2 text-[11px] text-[color:var(--primary)]/45">
          💡 לחצו על מילה לסימון 📌 מילה מנחה או 🤔 מילה קשה · יש שאלה? לחצו על הבועית 💭 שמתחת לקטע
        </p>
      )}
      {/* the question bubble — grows out of the passage box itself */}
      {!readOnly && onAskQuestion && (
        <button
          onClick={() => onAskQuestion(passage.ref)}
          className="absolute -bottom-4 flex items-center gap-1.5 rounded-full border-2 px-4 py-1.5 text-xs font-bold shadow-md transition hover:scale-[1.04]"
          style={{
            insetInlineStart: "1.5rem",
            background: "var(--card)",
            borderColor: "#2f5d8a",
            color: "#2f5d8a",
          }}
        >
          <span aria-hidden>💭</span>
          <span>יש לי שאלה על הקטע הזה</span>
        </button>
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
  onAskQuestion,
}: {
  block: TaskBlock;
  answers: Record<string, string>;
  setAnswer: (k: string, v: string) => void;
  markOf: (p: string, i: number) => Marking[];
  setMenu: (m: WordMenuState | null) => void;
  readOnly: boolean;
  askClaude: (context: string, input: string) => void;
  onAskQuestion?: (ref: string) => void;
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
        onAskQuestion={onAskQuestion}
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
              askClaude(`קריאת המקור: ${block.title} — ${block.text.slice(0, 200)}`, "לא הבנתי את המקור הזה")
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
              `שאלה במשימה [${q.label}]: ${q.prompt}. מה שנכתב עד כה: ${answers[q.key] ?? "(כלום)"}`,
              "לא ברור לי איך לגשת לשאלה"
            )
          }
          className="mt-2 text-[11px] text-[color:var(--accent)] underline-offset-2 hover:underline"
        >
          ✨ נתקעתם? עזרה קטנה מקלוד
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
        placeholder="כתבו כאן..."
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
