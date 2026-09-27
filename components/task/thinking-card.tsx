"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PlenaryQuestion } from "@/content/tasks/types";
import SaveButton from "@/components/save-button";

// "💭 שאלה למחשבה" — the plenary question as the STUDENT meets it: the last
// card of the task, after Part B. Deliberately inert: no answer field, no
// Claude button, no grade, and no promise of a class discussion (the
// teacher may choose to re-teach the weak part instead). Teachers outside
// student mode get an in-place editor for the question.
export default function ThinkingCard({
  plenary,
  contentRef,
  canEdit,
}: {
  plenary: PlenaryQuestion | null;
  contentRef: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  if (!plenary && !canEdit) return null;
  return (
    <section className="rounded-2xl border-2 border-[color:var(--primary)]/30 bg-[color:var(--card)] p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-extrabold text-[color:var(--primary)]">
            💭 שאלה למחשבה
          </p>
          <p className="text-xs text-[color:var(--foreground)]/55">
            סיימתם את המשימה — נשארה שאלה אחת, בלי לכתוב עליה כלום.
          </p>
        </div>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="shrink-0 rounded-full border border-dashed border-[color:var(--primary)]/40 px-3 py-1 text-[11px] font-bold text-[color:var(--primary)]/70 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
          >
            ✏️ עריכה (למורה)
          </button>
        )}
      </div>
      {editing ? (
        <PlenaryEditor
          contentRef={contentRef}
          initial={plenary}
          onClose={() => setEditing(false)}
        />
      ) : plenary ? (
        <>
          <blockquote className="mt-3 rounded-xl border-s-4 border-[color:var(--primary)] bg-[color:var(--background)] px-4 py-3 text-base font-semibold leading-8 text-[color:var(--foreground)]">
            {plenary.question}
          </blockquote>
          <p className="mt-3 text-xs text-[color:var(--primary)]/55">
            אין כאן מקום לענות. רק לחשוב — עם מה שגיליתם בפרק.
          </p>
        </>
      ) : (
        <p className="mt-2 text-xs text-[color:var(--warning)]">
          למשימה זו עוד לא נכתבה שאלה למחשבה — לחצי על ״עריכה״ כדי להוסיף.
        </p>
      )}
    </section>
  );
}

// Shared by the thinking card and the closing screen.
export function PlenaryEditor({
  contentRef,
  initial,
  onClose,
}: {
  contentRef: string;
  initial: PlenaryQuestion | null;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial?.question ?? "");
  const [saved, setSaved] = useState(initial?.question ?? "");
  const dirty = text.trim() !== saved.trim() && text.trim().length > 0;

  const save = async () => {
    const res = await fetch("/api/content-overrides", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentRef, field: "plenary", value: { question: text } }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "השמירה נכשלה");
    setSaved(data.value.question);
    setText(data.value.question);
    router.refresh();
  };

  return (
    <div className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
      <label className="block text-[11px] font-semibold text-[color:var(--primary)]/60">
        שאלת המליאה — לדיון חי בלבד. לתלמידים היא מופיעה כ״שאלה למחשבה״, בלי שדה תשובה.
      </label>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm leading-7 outline-none focus:border-[color:var(--accent)]"
      />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SaveButton dirty={dirty} onSave={save} />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={async () => {
              if (!window.confirm("לחזור לנוסח המקורי של שאלת המליאה?")) return;
              await fetch("/api/content-overrides", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentRef, field: "plenary", reset: true }),
              });
              router.refresh();
              onClose?.();
            }}
            className="text-xs font-semibold text-[color:var(--primary)]/50 hover:text-[color:var(--danger)]"
          >
            ↺ לנוסח המקורי
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[color:var(--border)] px-3 py-1 text-xs font-semibold text-[color:var(--primary)]/70 hover:border-[color:var(--accent)]"
            >
              סגירה
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
