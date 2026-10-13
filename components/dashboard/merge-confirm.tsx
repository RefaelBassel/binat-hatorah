"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { MergeSide } from "@/lib/account-merge";
import { mergeAction } from "@/app/dashboard/students/actions";

// The merge confirmation (#19). Nothing changes until the teacher presses
// the button; then both accounts are backed up and folded into the chosen
// primary account in one step.
function fmt(ts: number | null) {
  if (!ts) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(ts * 1000));
}

const hasHebrew = (s: string | null) => Boolean(s && /[א-ת]/.test(s));
const workCount = (s: MergeSide) => s.tasks.filter((t) => t.answers > 0 || t.submitted).length;

export default function MergeConfirm({ left, right }: { left: MergeSide; right: MergeSide }) {
  const router = useRouter();
  // default primary: the account with more work, then the one with a Hebrew name
  const defaultPrimary =
    workCount(right) > workCount(left) ||
    (workCount(right) === workCount(left) && hasHebrew(right.fullName) && !hasHebrew(left.fullName))
      ? right.id
      : left.id;
  const [primaryId, setPrimaryId] = useState(defaultPrimary);
  const names = [...new Set([left.fullName, right.fullName].filter((n): n is string => Boolean(n?.trim())))];
  const defaultName =
    names.find(hasHebrew) ?? (primaryId === left.id ? left.fullName : right.fullName) ?? names[0] ?? "";
  const [nameChoice, setNameChoice] = useState<string>(defaultName ? defaultName : "__custom");
  const [custom, setCustom] = useState("");
  const [busy, start] = useTransition();
  const [phase, setPhase] = useState<"idle" | "done">("idle");
  const [err, setErr] = useState<string | null>(null);

  const secondaryId = primaryId === left.id ? right.id : left.id;
  const fullName = nameChoice === "__custom" ? custom.trim() : nameChoice;
  const bothTasks = new Set(
    left.tasks
      .filter((t) => t.answers > 0 || t.submitted)
      .map((t) => t.taskId)
      .filter((id) => right.tasks.some((r) => r.taskId === id && (r.answers > 0 || r.submitted)))
  );

  const run = () =>
    start(async () => {
      setErr(null);
      const r = await mergeAction(primaryId, secondaryId, fullName);
      if (r.ok) {
        setPhase("done");
        window.setTimeout(() => router.push("/dashboard/students"), 1400);
      } else {
        setErr(r.error ?? "משהו השתבש — לא שונה דבר.");
      }
    });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        {[left, right].map((side) => (
          <SideCard
            key={side.id}
            side={side}
            primary={primaryId === side.id}
            bothTasks={bothTasks}
            onPick={() => setPrimaryId(side.id)}
            disabled={busy || phase === "done"}
          />
        ))}
      </div>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
        <h2 className="mb-2 font-display text-base font-extrabold text-[color:var(--primary)]">איזה שם להציג?</h2>
        <div className="space-y-1.5 text-sm">
          {names.map((n) => (
            <label key={n} className="flex items-center gap-2">
              <input
                type="radio"
                name="merge-name"
                checked={nameChoice === n}
                onChange={() => setNameChoice(n)}
                disabled={busy || phase === "done"}
              />
              {n}
            </label>
          ))}
          <label className="flex flex-wrap items-center gap-2">
            <input
              type="radio"
              name="merge-name"
              checked={nameChoice === "__custom"}
              onChange={() => setNameChoice("__custom")}
              disabled={busy || phase === "done"}
            />
            שם אחר:
            <input
              value={custom}
              onChange={(e) => {
                setCustom(e.target.value);
                setNameChoice("__custom");
              }}
              maxLength={80}
              placeholder="שם מלא בעברית"
              disabled={busy || phase === "done"}
              className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-1 text-sm outline-none focus:border-[color:var(--accent)]"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5 text-sm leading-relaxed">
        <h2 className="mb-2 font-display text-base font-extrabold text-[color:var(--primary)]">מה יקרה באיחוד</h2>
        <ul className="list-disc space-y-1 ps-5 text-[color:var(--foreground)]/80">
          <li>לפני הכול נשמר גיבוי מלא של שני החשבונות.</li>
          <li>
            כל העבודה של החשבון המשני עוברת לראשי: תשובות, התקדמות, הגשות, ציונים והצעות ציון, תרגולי כתיבה,
            הודעות וזמני עבודה. שום עבודה לא נמחקת.
          </li>
          <li>
            במשימה שיש בה עבודה בשני החשבונות: ההגשה נשמרת כעיקרית; שדה שענו עליו בשניהם — התשובה העיקרית
            (או החדשה) למעלה, והשנייה מתחתיה עם הסימון ״(מחשבון נוסף)״; שדה ריק מקבל את התשובה מהחשבון השני.
          </li>
          <li>אחרי האיחוד התלמיד נכנס מכל אחד משני המיילים לאותו חשבון, והחשבון המשני יורד מהרשימה.</li>
          <li>אפשר לבטל בכל עת ב״הפרדה״ ליד המייל המקושר ברשימת התלמידים.</li>
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || phase === "done" || !fullName}
          onClick={run}
          className={`rounded-full px-6 py-2.5 text-sm font-bold text-white transition disabled:opacity-60 ${
            phase === "done" ? "bg-[color:var(--success-fill)]" : "bg-[color:var(--primary-fill)]"
          } ${busy ? "scale-95" : ""}`}
        >
          {busy
            ? "מגבה ומאחד…"
            : phase === "done"
              ? "✓ החשבונות אוחדו!"
              : `איחוד לחשבון של ${(primaryId === left.id ? left : right).email}`}
        </button>
        {!fullName && <span className="text-xs text-[color:var(--warning)]">יש לבחור שם להצגה.</span>}
        {err && <span className="text-xs font-semibold text-[color:var(--danger)]">{err}</span>}
      </div>
    </div>
  );
}

function SideCard({
  side,
  primary,
  bothTasks,
  onPick,
  disabled,
}: {
  side: MergeSide;
  primary: boolean;
  bothTasks: Set<number>;
  onPick: () => void;
  disabled: boolean;
}) {
  return (
    <section
      className={`rounded-2xl border-2 bg-[color:var(--card)] p-5 transition ${
        primary ? "border-[color:var(--accent)]" : "border-[color:var(--border)]"
      }`}
    >
      <label className="mb-3 flex cursor-pointer items-center gap-2 text-sm font-bold text-[color:var(--primary)]">
        <input type="radio" name="merge-primary" checked={primary} onChange={onPick} disabled={disabled} />
        {primary ? "⭐ החשבון הראשי" : "חשבון משני — יאוחד לראשי"}
      </label>
      <p className="font-display text-lg font-extrabold text-[color:var(--foreground)]">
        {side.fullName ?? <span className="text-[color:var(--warning)]">(ללא שם)</span>}
      </p>
      <p className="text-xs text-[color:var(--primary)]/65">
        {side.emails.map((e) => (
          <span key={e} dir="ltr" className="me-2 inline-block">
            {e}
          </span>
        ))}
      </p>
      <p className="mb-3 text-xs text-[color:var(--primary)]/65">כניסה אחרונה: {fmt(side.lastSeenAt)}</p>

      <h3 className="mb-1 text-xs font-bold text-[color:var(--primary)]/70">משימות ({side.tasks.length})</h3>
      {side.tasks.length === 0 ? (
        <p className="text-xs text-[color:var(--foreground)]/55">אין משימות בחשבון הזה.</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)] text-xs">
          {side.tasks.map((t) => (
            <li key={t.taskId} className="py-1.5">
              <p className="font-semibold text-[color:var(--foreground)]">
                {t.title}
                {bothTasks.has(t.taskId) && (
                  <span className="ms-1.5 rounded-full bg-[color:var(--warning)]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--warning)]">
                    עבודה בשני החשבונות
                  </span>
                )}
              </p>
              <p className="text-[color:var(--primary)]/65">
                {t.state}
                {!t.submitted && t.progressPct > 0 && ` · ${t.progressPct}%`}
                {" · "}
                {t.answers} תשובות
                {t.grade && ` · ${t.grade}`}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-[color:var(--primary)]/60">
        תרגולי כתיבה: {side.writing} · הודעות: {side.messages} · שאלות במאגר: {side.questions}
      </p>
    </section>
  );
}
