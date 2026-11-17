"use client";

import { useActionState } from "react";
import ConfirmButton from "@/components/confirm-button";

// Teacher controls for a task whose publication is scheduled: change the
// publication time, publish right now, or cancel the schedule (the task goes
// back to unpublished). Every button shows its pending state.
export type ScheduleState =
  | { status: "idle" }
  | { status: "done"; label: string }
  | { status: "error"; message: string };

function Spinner() {
  return (
    <span
      aria-hidden
      className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
    />
  );
}

function ActionButton({
  action,
  className,
  pendingLabel,
  label,
  confirm,
}: {
  action: (prev: ScheduleState, formData: FormData) => Promise<ScheduleState>;
  className: string;
  pendingLabel: string;
  label: string;
  confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const base = `inline-flex items-center gap-2 rounded-full px-5 py-1.5 text-sm font-bold shadow transition ${
    pending ? "scale-[0.96] cursor-wait opacity-80 shadow-inner" : "hover:scale-[1.02]"
  } ${className}`;
  return (
    <form action={formAction} className="inline-flex flex-col gap-1">
      {confirm && !pending ? (
        <ConfirmButton message={confirm} className={base}>
          {label}
        </ConfirmButton>
      ) : (
        <button type="submit" disabled={pending} className={base}>
          {pending && <Spinner />}
          {pending ? pendingLabel : label}
        </button>
      )}
      {!pending && state.status === "error" && (
        <span aria-live="polite" className="text-xs font-semibold text-[color:var(--danger)]">
          {state.message}
        </span>
      )}
    </form>
  );
}

export default function ScheduleControls({
  publishLabel,
  publishDate,
  publishTime,
  changeAction,
  publishNowAction,
  cancelAction,
}: {
  publishLabel: string;
  publishDate: string;
  publishTime: string;
  changeAction: (prev: ScheduleState, formData: FormData) => Promise<ScheduleState>;
  publishNowAction: (prev: ScheduleState, formData: FormData) => Promise<ScheduleState>;
  cancelAction: (prev: ScheduleState, formData: FormData) => Promise<ScheduleState>;
}) {
  const [state, formAction, pending] = useActionState(changeAction, { status: "idle" });
  return (
    <div className="mb-8 rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--accent)]/5 p-5">
      <p className="font-display text-base font-bold text-[color:var(--accent)]">
        ⏰ מתוזמנת — תתפרסם ב-{publishLabel}
      </p>
      <p className="mt-1 text-sm text-[color:var(--foreground)]/70">
        עד אז התלמידות לא רואות את המשימה בשום מקום. ברגע שיגיע המועד היא תופיע לכל הכיתה
        אוטומטית.
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          type="date"
          name="publishDate"
          defaultValue={publishDate}
          required
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1.5 text-sm"
        />
        <input
          type="time"
          name="publishTime"
          defaultValue={publishTime}
          required
          className="rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className={`inline-flex items-center gap-2 rounded-full bg-[color:var(--primary-fill)] px-5 py-1.5 text-sm font-bold text-white shadow transition ${
            pending ? "scale-[0.96] cursor-wait opacity-80 shadow-inner" : "hover:scale-[1.02]"
          }`}
        >
          {pending && <Spinner />}
          {pending ? "מעדכן..." : "שינוי מועד הפרסום"}
        </button>
        {!pending && state.status === "done" && (
          <span aria-live="polite" className="text-xs font-semibold text-[color:var(--success)]">
            ✓ {state.label}
          </span>
        )}
        {!pending && state.status === "error" && (
          <span aria-live="polite" className="text-xs font-semibold text-[color:var(--danger)]">
            {state.message}
          </span>
        )}
      </form>
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <ActionButton
          action={publishNowAction}
          className="bg-[color:var(--success-fill)] text-white"
          label="📣 פרסום עכשיו"
          pendingLabel="מפרסם..."
          confirm="לפרסם את המשימה לכל הכיתה עכשיו?"
        />
        <ActionButton
          action={cancelAction}
          className="border-2 border-[color:var(--danger)]/60 text-[color:var(--danger)] shadow-none"
          label="ביטול התזמון"
          pendingLabel="מבטל..."
          confirm="לבטל את התזמון? המשימה תחזור להיות לא מפורסמת ותוסר מהכיתה (אפשר לפרסם מחדש בכל רגע)."
        />
      </div>
    </div>
  );
}
