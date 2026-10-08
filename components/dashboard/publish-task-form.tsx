"use client";

import { useActionState } from "react";

// Dashboard "publish a new task" form. The button locks on the first click
// ("מפרסם…") until the server answers, and a unit that is already active
// is never published twice — the teacher is offered a due-date change.
export type PublishState =
  | { status: "idle" }
  | { status: "created" | "republished"; title: string }
  | {
      status: "exists";
      taskId: number;
      title: string;
      currentDue: string;
      newDue: string;
      dueDate: string;
      dueTime: string;
    }
  | { status: "error"; message: string };

export type RescheduleState =
  | { status: "idle" }
  | { status: "done"; title: string; newDue: string }
  | { status: "error"; message: string };

export default function PublishTaskForm({
  options,
  publishAction,
  rescheduleAction,
}: {
  options: { ref: string; title: string }[];
  publishAction: (prev: PublishState, formData: FormData) => Promise<PublishState>;
  rescheduleAction: (prev: RescheduleState, formData: FormData) => Promise<RescheduleState>;
}) {
  const [state, formAction, pending] = useActionState(publishAction, { status: "idle" });

  return (
    <div>
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            משימה מספריית התוכן
          </span>
          <select
            name="contentRef"
            className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
          >
            {options.map((o) => (
              <option key={o.ref} value={o.ref}>
                {o.title}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            תאריך אחרון להגשה
          </span>
          <input
            type="date"
            name="dueDate"
            required
            className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            עד השעה
          </span>
          <input
            type="time"
            name="dueTime"
            defaultValue="23:59"
            className="rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-full bg-[color:var(--primary)] px-6 py-2.5 text-sm font-bold text-white shadow transition ${
            pending ? "scale-[0.96] cursor-wait opacity-80 shadow-inner" : "hover:scale-[1.02]"
          }`}
        >
          {pending && (
            <span
              aria-hidden
              className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
            />
          )}
          {pending ? "מפרסם..." : "פרסום והקצאה לכל הכיתה"}
        </button>
      </form>

      {!pending && (state.status === "created" || state.status === "republished") && (
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-[color:var(--success)]">
          ✓ ״{state.title}״ פורסמה והוקצתה לכל הכיתה
        </p>
      )}
      {!pending && state.status === "error" && (
        <p aria-live="polite" className="mt-3 text-sm font-semibold text-[color:var(--danger)]">
          {state.message}
        </p>
      )}
      {!pending && state.status === "exists" && (
        <AlreadyPublished
          key={`${state.taskId}-${state.dueDate}-${state.dueTime}`}
          notice={state}
          rescheduleAction={rescheduleAction}
        />
      )}
    </div>
  );
}

// keyed by (task, requested date): a fresh notice never shows a stale "done"
function AlreadyPublished({
  notice,
  rescheduleAction,
}: {
  notice: Extract<PublishState, { status: "exists" }>;
  rescheduleAction: (prev: RescheduleState, formData: FormData) => Promise<RescheduleState>;
}) {
  const [resState, resAction, resPending] = useActionState(rescheduleAction, { status: "idle" });
  return (
    <div className="mt-4 rounded-xl border border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10 p-4 text-sm">
      <p className="font-bold text-[color:var(--warning)]">היחידה כבר פורסמה — לשנות מועד?</p>
      <p className="mt-1 text-[color:var(--foreground)]/75">
        ״{notice.title}״ כבר פעילה אצל הכיתה, להגשה עד {notice.currentDue}. לא נוצר עותק נוסף.
      </p>
      {resState.status === "done" ? (
        <p className="mt-3 font-semibold text-[color:var(--success)]">
          ✓ המועד עודכן: להגשה עד {resState.newDue}
        </p>
      ) : (
        <form action={resAction} className="mt-3 flex flex-wrap items-center gap-3">
          <input type="hidden" name="taskId" value={notice.taskId} />
          <input type="hidden" name="dueDate" value={notice.dueDate} />
          <input type="hidden" name="dueTime" value={notice.dueTime} />
          <button
            type="submit"
            disabled={resPending}
            className={`inline-flex items-center gap-2 rounded-full bg-[color:var(--accent)] px-5 py-2 text-sm font-bold text-white shadow transition ${
              resPending ? "scale-[0.96] cursor-wait opacity-80 shadow-inner" : "hover:scale-[1.02]"
            }`}
          >
            {resPending && (
              <span
                aria-hidden
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
              />
            )}
            {resPending ? "מעדכן מועד..." : `כן, לשנות ל־${notice.newDue}`}
          </button>
          {resState.status === "error" && (
            <span className="text-xs font-semibold text-[color:var(--danger)]">{resState.message}</span>
          )}
        </form>
      )}
    </div>
  );
}
