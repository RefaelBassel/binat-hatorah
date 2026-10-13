"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { AccountRow } from "@/lib/approval";
import type { ActiveMerge } from "@/lib/account-merge";
import {
  approveAction,
  blockAction,
  preApproveAction,
  removeAction,
  renameAction,
  unblockAction,
  unmergeAction,
} from "@/app/dashboard/students/actions";

// What every student row needs for names and merges (#19): the other
// accounts to merge with, the active merges, and look-alike names.
interface MergeCtx {
  students: AccountRow[];
  merges: ActiveMerge[];
  similar: Record<number, number[]>;
}

// The roster UI. Every row shows the Hebrew name (if onboarded), the Google
// email, when the account appeared and when it was last seen — enough to
// tell a classmate from a stranger. Actions are immediate, with a visible
// working state; removal asks for confirmation and deletes everything.
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

export default function StudentsAdmin({
  pending,
  approved,
  blocked,
  teachers,
  students,
  merges,
  similar,
}: {
  pending: AccountRow[];
  approved: AccountRow[];
  blocked: AccountRow[];
  teachers: AccountRow[];
  students: AccountRow[];
  merges: ActiveMerge[];
  similar: Record<number, number[]>;
}) {
  const ctx: MergeCtx = { students, merges, similar };
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PreApprove />

      <Group
        ctx={ctx}
        title={`⏳ ממתינים לאישור (${pending.length})`}
        tone="warning"
        empty="אין חשבונות שממתינים — כל מי שנכנס כבר אושר או הוסר."
        rows={pending}
        actions={(a) => (
          <>
            <ActionBtn label="✓ אישור" tone="success" run={() => approveAction(a.id)} />
            <ActionBtn
              label="✗ הסרה"
              tone="danger"
              confirm={`להסיר את ${a.fullName ?? a.email} מהאתר לצמיתות? לא מהכיתה — לא נשאר כלום.`}
              run={() => removeAction(a.id)}
            />
          </>
        )}
      />

      <Group
        ctx={ctx}
        title={`✅ מאושרים (${approved.length})`}
        tone="success"
        empty="עוד אין תלמידים מאושרים."
        rows={approved}
        actions={(a) => (
          <>
            <ActionBtn
              label="חסימה"
              tone="muted"
              confirm={`לחסום את ${a.fullName ?? a.email}? העבודה נשמרת, אבל הכניסה נסגרת עד לביטול החסימה.`}
              run={() => blockAction(a.id)}
            />
            <ActionBtn
              label="✗ הסרה"
              tone="danger"
              confirm={`להסיר את ${a.fullName ?? a.email} לצמיתות, כולל כל מה ששמר/ה באתר? הפעולה לא הפיכה.`}
              run={() => removeAction(a.id)}
            />
          </>
        )}
      />

      {blocked.length > 0 && (
        <Group
          ctx={ctx}
          title={`🔒 חסומים (${blocked.length})`}
          tone="danger"
          empty=""
          rows={blocked}
          actions={(a) => (
            <>
              <ActionBtn label="ביטול חסימה" tone="success" run={() => unblockAction(a.id)} />
              <ActionBtn
                label="✗ הסרה"
                tone="danger"
                confirm={`להסיר את ${a.fullName ?? a.email} לצמיתות?`}
                run={() => removeAction(a.id)}
              />
            </>
          )}
        />
      )}

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
        <p className="mb-2 text-xs font-bold text-[color:var(--primary)]/60">👩‍🏫 מורות (מאושרות תמיד)</p>
        <ul className="space-y-1 text-sm">
          {teachers.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              <span className="font-semibold">{t.fullName ?? t.email}</span>
              <span className="text-xs text-[color:var(--primary)]/55" dir="ltr">
                {t.email}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Group({
  ctx,
  title,
  tone,
  empty,
  rows,
  actions,
}: {
  ctx: MergeCtx;
  title: string;
  tone: "warning" | "success" | "danger";
  empty: string;
  rows: AccountRow[];
  actions: (a: AccountRow) => React.ReactNode;
}) {
  const border =
    tone === "warning"
      ? "border-[color:var(--warning)]/50"
      : tone === "danger"
        ? "border-[color:var(--danger)]/40"
        : "border-[color:var(--border)]";
  return (
    <section className={`rounded-2xl border-2 bg-[color:var(--card)] p-5 ${border}`}>
      <h2 className="mb-3 font-display text-lg font-extrabold text-[color:var(--primary)]">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-[color:var(--foreground)]/55">{empty}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--border)]">
          {rows.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-[color:var(--foreground)]">
                  {a.fullName ?? <span className="text-[color:var(--warning)]">(עוד לא הזין/ה שם)</span>}
                  {a.hasWork && (
                    <span className="ms-2 rounded-full bg-[color:var(--primary)]/10 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--primary)]">
                      יש עבודה שמורה
                    </span>
                  )}
                </p>
                <p className="text-xs text-[color:var(--primary)]/60">
                  <span dir="ltr">{a.email}</span>
                  {" · "}נכנס/ה לראשונה {fmt(a.createdAt)}
                  {" · "}נראה/תה לאחרונה {fmt(a.lastSeenAt)}
                </p>
                <LinkedEmails account={a} merges={ctx.merges.filter((m) => m.primaryId === a.id)} />
                <SimilarHint account={a} ctx={ctx} />
              </div>
              <div className="flex shrink-0 items-center gap-2">{actions(a)}</div>
              <RowTools account={a} ctx={ctx} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionBtn({
  label,
  tone,
  confirm,
  run,
}: {
  label: string;
  tone: "success" | "danger" | "muted";
  confirm?: string;
  run: () => Promise<{ ok: boolean; error?: string }>;
}) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const cls =
    tone === "success"
      ? "bg-[color:var(--success-fill)] text-white"
      : tone === "danger"
        ? "border border-[color:var(--danger)]/50 text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
        : "border border-[color:var(--border)] text-[color:var(--primary)]/75 hover:border-[color:var(--accent)]";
  return (
    <span className="flex flex-col items-end">
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (confirm && !window.confirm(confirm)) return;
          setErr(null);
          start(async () => {
            const r = await run();
            if (!r.ok) setErr(r.error ?? "משהו השתבש");
          });
        }}
        className={`rounded-full px-3 py-1 text-xs font-bold transition disabled:opacity-50 ${cls} ${busy ? "scale-95" : ""}`}
      >
        {busy ? "…" : label}
      </button>
      {err && <span className="mt-0.5 text-[10px] text-[color:var(--danger)]">{err}</span>}
    </span>
  );
}

// Every email that signs in to this student. Emails merged in from another
// account can be separated again ("הפרדה" restores both accounts).
function LinkedEmails({ account, merges }: { account: AccountRow; merges: ActiveMerge[] }) {
  if (account.emails.length < 2) return null;
  return (
    <div className="mt-1 space-y-1">
      <p className="text-[11px] font-semibold text-[color:var(--primary)]/70">
        🔗 מיילים מקושרים ({account.emails.length}) — מכל אחד מהם נכנסים לאותו חשבון:
      </p>
      <ul className="space-y-1">
        {account.emails.map((email, i) => {
          const merge = merges.find((m) => m.secondaryEmail === email);
          return (
            <li key={email} className="flex flex-wrap items-center gap-2 text-xs text-[color:var(--primary)]/70">
              <span dir="ltr">{email}</span>
              {i === 0 && <span className="text-[10px] text-[color:var(--primary)]/50">(ראשי)</span>}
              {merge &&
                (merge.canUndo ? (
                  <ActionBtn
                    label="הפרדה"
                    tone="muted"
                    confirm={`להפריד את ${email} בחזרה לחשבון נפרד? שני החשבונות יחזרו למצב שלפני האיחוד (עבודה שנעשתה אחרי האיחוד נשארת בחשבון הראשי).`}
                    run={() => unmergeAction(merge.id)}
                  />
                ) : (
                  <span className="text-[10px] text-[color:var(--primary)]/50">
                    (להפרדה — יש להפריד קודם את האיחוד המאוחר יותר)
                  </span>
                ))}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// A gentle hint only — never an automatic merge.
function SimilarHint({ account, ctx }: { account: AccountRow; ctx: MergeCtx }) {
  const others = (ctx.similar[account.id] ?? [])
    .map((id) => ctx.students.find((s) => s.id === id))
    .filter((s): s is AccountRow => Boolean(s));
  if (others.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5">
      {others.map((o) => (
        <Link
          key={o.id}
          href={`/dashboard/students/merge?a=${account.id}&b=${o.id}`}
          className="rounded-full bg-[color:var(--warning)]/12 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--warning)] hover:underline"
        >
          🤔 ייתכן שזה אותו תלמיד כמו {o.fullName ?? o.email} — לבדיקה
        </Link>
      ))}
    </div>
  );
}

// Per-row teacher tools: edit the display name, or pick another account to
// merge with (the merge itself happens on the confirmation screen).
function RowTools({ account, ctx }: { account: AccountRow; ctx: MergeCtx }) {
  const [open, setOpen] = useState<"rename" | "merge" | null>(null);
  const toggle = (which: "rename" | "merge") => setOpen((o) => (o === which ? null : which));
  const btn = (active: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-bold transition ${
      active
        ? "border-[color:var(--accent)] bg-[color:var(--accent)]/10 text-[color:var(--accent)]"
        : "border-[color:var(--border)] text-[color:var(--primary)]/75 hover:border-[color:var(--accent)]"
    }`;
  return (
    <div className="basis-full">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => toggle("rename")} className={btn(open === "rename")}>
          ✏️ עריכה
        </button>
        <button type="button" onClick={() => toggle("merge")} className={btn(open === "merge")}>
          🔗 איחוד עם תלמיד אחר
        </button>
      </div>
      {open === "rename" && <RenameForm account={account} onDone={() => setOpen(null)} />}
      {open === "merge" && <MergePicker account={account} ctx={ctx} />}
    </div>
  );
}

function RenameForm({ account, onDone }: { account: AccountRow; onDone: () => void }) {
  const [name, setName] = useState(account.fullName ?? "");
  const [busy, start] = useTransition();
  const [phase, setPhase] = useState<"idle" | "saved" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);
  const dirty = name.trim() !== "" && name.trim() !== (account.fullName ?? "");
  const save = () =>
    start(async () => {
      setErr(null);
      const r = await renameAction(account.id, name);
      if (r.ok) {
        setPhase("saved");
        window.setTimeout(onDone, 1200);
      } else {
        setPhase("error");
        setErr(r.error ?? "לא נשמר — נסי שוב");
      }
    });
  return (
    <div className="mt-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
      <label className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
        השם שיוצג בכל האתר (דופק כיתה, הגשות, הודעות)
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setPhase("idle");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && dirty && !busy) save();
          }}
          maxLength={80}
          placeholder="שם מלא בעברית"
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
        />
        <button
          type="button"
          disabled={!dirty || busy}
          onClick={save}
          className={`rounded-full px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-40 ${
            phase === "saved" ? "bg-[color:var(--success-fill)]" : "bg-[color:var(--primary-fill)]"
          } ${busy ? "scale-95" : ""}`}
        >
          {busy ? "שומר…" : phase === "saved" ? "✓ נשמר!" : dirty ? "שמירת השם" : "אין שינויים"}
        </button>
      </div>
      {err && <p className="mt-1 text-[11px] text-[color:var(--danger)]">{err}</p>}
    </div>
  );
}

function MergePicker({ account, ctx }: { account: AccountRow; ctx: MergeCtx }) {
  const [other, setOther] = useState("");
  const options = ctx.students.filter((s) => s.id !== account.id);
  return (
    <div className="mt-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
      <label className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
        עם איזה חשבון לאחד את {account.fullName ?? account.email}?
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={other}
          onChange={(e) => setOther(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]"
        >
          <option value="">בחרי חשבון…</option>
          {options.map((s) => (
            <option key={s.id} value={s.id}>
              {(s.fullName ?? "(ללא שם)") + " — " + s.email}
            </option>
          ))}
        </select>
        {other ? (
          <Link
            href={`/dashboard/students/merge?a=${account.id}&b=${other}`}
            className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-xs font-bold text-white"
          >
            המשך למסך האישור ←
          </Link>
        ) : (
          <span className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-xs font-bold text-white opacity-40">
            המשך למסך האישור ←
          </span>
        )}
      </div>
      <p className="mt-1 text-[11px] text-[color:var(--foreground)]/55">
        במסך הבא רואים את שני החשבונות זה לצד זה ובוחרים איזה מהם יהיה הראשי. שום דבר לא משתנה עד האישור.
      </p>
    </div>
  );
}

// Pre-approve by email: paste the class list once and everyone walks in on
// first sign-in, no waiting.
function PreApprove() {
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <section className="rounded-2xl border border-dashed border-[color:var(--border)] bg-[color:var(--card)] p-5">
      <p className="font-display text-base font-bold text-[color:var(--primary)]">
        ➕ אישור מראש לפי מייל
      </p>
      <p className="mb-2 text-xs text-[color:var(--foreground)]/60">
        הדביקי כתובות גוגל של תלמידי הכיתה (מופרדות ברווח, פסיק או שורה). מי שברשימה ייכנס
        ישר, בלי להמתין לאישור.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        dir="ltr"
        placeholder="name1@gmail.com, name2@school.org.il"
        className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--accent)]"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          disabled={busy || !text.includes("@")}
          onClick={() =>
            start(async () => {
              const r = await preApproveAction(text);
              setMsg(r.ok ? `נוספו ${r.added} כתובות ✓` : (r.error ?? "משהו השתבש"));
              if (r.ok) setText("");
            })
          }
          className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-xs font-bold text-white transition disabled:opacity-40"
        >
          {busy ? "מוסיף…" : "הוספה לרשימה המאושרת"}
        </button>
        {msg && <span className="text-xs font-semibold text-[color:var(--success)]">{msg}</span>}
      </div>
    </section>
  );
}
