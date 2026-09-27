"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CheckKind, CheckOpenQuestion, CheckQuestion } from "@/content/tasks/types";
import SaveButton from "@/components/save-button";

// In-place teacher editor for the comprehension check: every question, its
// kind, options, correct answer and chapter part, plus the open question.
// What Rafael and Claude wrote is only the default — whatever is saved here
// is stored per content ref and wins. Teachers only; the affordance that
// opens this editor is decided server-side, students never see it.
const KIND_LABEL: Record<CheckKind, string> = {
  choice: "רב-ברירה",
  truefalse: "נכון / לא נכון",
  order: "סידור לפי הפרק",
};

function blank(n: number): CheckQuestion {
  return {
    key: `q${n}-${Date.now().toString(36)}`,
    kind: "choice",
    prompt: "",
    part: "",
    options: ["", ""],
    answer: 0,
  };
}

export default function CheckEditor({
  contentRef,
  initialCheck,
  initialOpen,
  onClose,
}: {
  contentRef: string;
  initialCheck: CheckQuestion[];
  initialOpen: CheckOpenQuestion | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [qs, setQs] = useState<CheckQuestion[]>(() =>
    initialCheck.map((q) => ({ ...q, options: [...q.options] }))
  );
  const [open, setOpen] = useState<CheckOpenQuestion | null>(initialOpen);
  const [savedSnapshot, setSavedSnapshot] = useState(() =>
    JSON.stringify({ qs: initialCheck, open: initialOpen })
  );
  const dirty = useMemo(
    () => JSON.stringify({ qs, open }) !== savedSnapshot,
    [qs, open, savedSnapshot]
  );

  const update = (i: number, patch: Partial<CheckQuestion>) =>
    setQs((all) => all.map((q, j) => (j === i ? { ...q, ...patch } : q)));

  const setKind = (i: number, kind: CheckKind) => {
    const q = qs[i];
    if (kind === "truefalse") update(i, { kind, options: ["נכון", "לא נכון"], answer: 0 });
    else if (kind === "order")
      update(i, {
        kind,
        options: q.kind === "truefalse" ? ["", "", ""] : q.options,
        answer: 0,
      });
    else update(i, { kind, options: q.kind === "truefalse" ? ["", ""] : q.options, answer: 0 });
  };

  const move = (i: number, dir: -1 | 1) =>
    setQs((all) => {
      const j = i + dir;
      if (j < 0 || j >= all.length) return all;
      const copy = [...all];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const moveOption = (i: number, k: number, dir: -1 | 1) => {
    const q = qs[i];
    const j = k + dir;
    if (j < 0 || j >= q.options.length) return;
    const opts = [...q.options];
    [opts[k], opts[j]] = [opts[j], opts[k]];
    let answer = q.answer;
    if (q.kind === "choice") {
      if (answer === k) answer = j;
      else if (answer === j) answer = k;
    }
    update(i, { options: opts, answer });
  };

  const save = async () => {
    const put = async (field: string, value: unknown) => {
      const res = await fetch("/api/content-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentRef, field, value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "השמירה נכשלה");
      return data.value;
    };
    const savedCheck = (await put("check", qs)) as CheckQuestion[];
    let savedOpen: CheckOpenQuestion | null = null;
    if (open && open.prompt.trim()) {
      savedOpen = (await put("checkOpen", open)) as CheckOpenQuestion;
    } else {
      // no open question: store an explicit empty marker is not supported,
      // so we reset to default only if the default is also empty
      await fetch("/api/content-overrides", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentRef, field: "checkOpen", reset: true }),
      });
    }
    setQs(savedCheck);
    setOpen(savedOpen);
    setSavedSnapshot(JSON.stringify({ qs: savedCheck, open: savedOpen }));
    router.refresh();
  };

  const problems = qs.flatMap((q, i) => {
    const out: string[] = [];
    if (!q.prompt.trim()) out.push(`שאלה ${i + 1}: חסר נוסח`);
    if (q.kind !== "truefalse" && q.options.filter((o) => o.trim()).length < 2)
      out.push(`שאלה ${i + 1}: צריך לפחות שתי אפשרויות`);
    if (!q.part.trim()) out.push(`שאלה ${i + 1}: לאיזה חלק בפרק היא שייכת?`);
    return out;
  });

  return (
    <div className="rounded-2xl border-2 border-[color:var(--primary)]/30 bg-[color:var(--card)] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-display text-lg font-extrabold text-[color:var(--primary)]">
            ✏️ עריכת בדיקת ההבנה
          </p>
          <p className="text-xs text-[color:var(--foreground)]/60">
            מה שתשמרי כאן הוא מה שהתלמידים יראו. המספר 1-10 מחושב רק מהשאלות הסגורות.
            ״חלק בפרק״ הוא מה שמופיע לך בדופק הכיתה כ״היכן הכיתה מתקשה״.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]"
          >
            סגירת העריכה
          </button>
        )}
      </div>

      <div className="space-y-4">
        {qs.map((q, i) => (
          <div
            key={q.key}
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4"
          >
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[color:var(--accent)]">שאלה {i + 1}</span>
              <select
                value={q.kind}
                onChange={(e) => setKind(i, e.target.value as CheckKind)}
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-xs"
              >
                {(Object.keys(KIND_LABEL) as CheckKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <span className="ms-auto flex items-center gap-1">
                <IconBtn title="להעלות" onClick={() => move(i, -1)} disabled={i === 0}>
                  ↑
                </IconBtn>
                <IconBtn title="להוריד" onClick={() => move(i, 1)} disabled={i === qs.length - 1}>
                  ↓
                </IconBtn>
                <IconBtn
                  title="למחוק שאלה"
                  onClick={() => setQs((all) => all.filter((_, j) => j !== i))}
                  danger
                >
                  ✕
                </IconBtn>
              </span>
            </div>

            <label className="block text-[11px] font-semibold text-[color:var(--primary)]/60">
              נוסח השאלה
            </label>
            <textarea
              value={q.prompt}
              onChange={(e) => update(i, { prompt: e.target.value })}
              rows={2}
              className="mb-3 mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
            />

            <label className="block text-[11px] font-semibold text-[color:var(--primary)]/60">
              חלק בפרק (למפת החום) — למשל: פסוק ז׳ — משמעות ״נִגָּרַע״
            </label>
            <input
              value={q.part}
              onChange={(e) => update(i, { part: e.target.value })}
              className="mb-3 mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
            />

            <p className="mb-1 text-[11px] font-semibold text-[color:var(--primary)]/60">
              {q.kind === "choice"
                ? "אפשרויות — סמני את הנכונה"
                : q.kind === "truefalse"
                  ? "מה התשובה הנכונה?"
                  : "האפשרויות בסדר הנכון (לתלמידים הן יוצגו מעורבבות)"}
            </p>
            <div className="space-y-1.5">
              {q.options.map((opt, k) => (
                <div key={k} className="flex items-center gap-2">
                  {q.kind === "order" ? (
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)] text-[11px] font-extrabold text-white">
                      {k + 1}
                    </span>
                  ) : (
                    <input
                      type="radio"
                      name={`ans-${q.key}`}
                      checked={q.answer === k}
                      onChange={() => update(i, { answer: k })}
                      title="התשובה הנכונה"
                      className="h-4 w-4 shrink-0 accent-[color:var(--success)]"
                    />
                  )}
                  {q.kind === "truefalse" ? (
                    <span className="text-sm">{opt}</span>
                  ) : (
                    <input
                      value={opt}
                      onChange={(e) =>
                        update(i, {
                          options: q.options.map((o, m) => (m === k ? e.target.value : o)),
                        })
                      }
                      placeholder={`אפשרות ${k + 1}`}
                      className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
                    />
                  )}
                  {q.kind !== "truefalse" && (
                    <>
                      <IconBtn title="להעלות" onClick={() => moveOption(i, k, -1)} disabled={k === 0}>
                        ↑
                      </IconBtn>
                      <IconBtn
                        title="להוריד"
                        onClick={() => moveOption(i, k, 1)}
                        disabled={k === q.options.length - 1}
                      >
                        ↓
                      </IconBtn>
                      <IconBtn
                        title="למחוק אפשרות"
                        danger
                        disabled={q.options.length <= 2}
                        onClick={() =>
                          update(i, {
                            options: q.options.filter((_, m) => m !== k),
                            answer:
                              q.answer === k
                                ? 0
                                : q.answer > k
                                  ? q.answer - 1
                                  : q.answer,
                          })
                        }
                      >
                        ✕
                      </IconBtn>
                    </>
                  )}
                </div>
              ))}
            </div>
            {q.kind !== "truefalse" && q.options.length < 8 && (
              <button
                type="button"
                onClick={() => update(i, { options: [...q.options, ""] })}
                className="mt-2 text-xs font-semibold text-[color:var(--accent)] hover:underline"
              >
                + אפשרות
              </button>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => setQs((all) => [...all, blank(all.length + 1)])}
          disabled={qs.length >= 12}
          className="w-full rounded-xl border-2 border-dashed border-[color:var(--border)] py-2.5 text-sm font-bold text-[color:var(--primary)]/70 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)] disabled:opacity-40"
        >
          + שאלה סגורה נוספת
        </button>

        <div className="rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)] p-4">
          <div className="mb-1 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-[color:var(--primary)]/70">
              שאלה פתוחה (לגיוון — לא נכנסת למספר)
            </p>
            <label className="flex items-center gap-2 text-[11px] font-semibold text-[color:var(--primary)]/60">
              <input
                type="checkbox"
                checked={open != null}
                onChange={(e) =>
                  setOpen(e.target.checked ? { key: "open", prompt: "" } : null)
                }
              />
              יש שאלה פתוחה
            </label>
          </div>
          {open && (
            <textarea
              value={open.prompt}
              onChange={(e) => setOpen({ ...open, prompt: e.target.value })}
              rows={2}
              placeholder="למשל: במילה או שתיים — מה מרגישים האנשים?"
              className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
            />
          )}
        </div>
      </div>

      {problems.length > 0 && dirty && (
        <ul className="mt-4 space-y-0.5 text-xs text-[color:var(--warning)]">
          {problems.map((p) => (
            <li key={p}>• {p}</li>
          ))}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border)] pt-4">
        <SaveButton dirty={dirty && problems.length === 0} onSave={save} />
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm("לחזור לנוסח המקורי של בדיקת ההבנה? העריכות שלך יימחקו.")) return;
            for (const field of ["check", "checkOpen"]) {
              await fetch("/api/content-overrides", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentRef, field, reset: true }),
              });
            }
            router.refresh();
            onClose?.();
          }}
          className="text-xs font-semibold text-[color:var(--primary)]/50 hover:text-[color:var(--danger)]"
        >
          ↺ חזרה לנוסח המקורי
        </button>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-xs transition disabled:opacity-30 ${
        danger
          ? "border-[color:var(--danger)]/40 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
          : "border-[color:var(--border)] text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]"
      }`}
    >
      {children}
    </button>
  );
}
