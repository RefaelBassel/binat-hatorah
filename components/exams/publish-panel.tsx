"use client";

import { useState } from "react";
import type { DocKind } from "@/lib/exam-types";

type Phase = "idle" | "busy" | "done" | "error";

function israelParts(unix: number | null): { date: string; time: string } {
  if (!unix) return { date: "", time: "08:30" };
  const d = new Date(unix * 1000);
  const date = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jerusalem" });
  const time = d.toLocaleTimeString("en-GB", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });
  return { date, time };
}

function fmt(unix: number) {
  return new Date(unix * 1000).toLocaleString("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });
}

// Publishing to students: a draft by default; the teacher decides if and
// when. A prep sheet becomes a reading page; an exam opens at a set time.
export default function PublishPanel({
  docId,
  kind,
  publishedAt,
  opensAt,
  durationMin,
  onChanged,
}: {
  docId: number;
  kind: DocKind;
  publishedAt: number | null;
  opensAt: number | null;
  durationMin: number | null;
  onChanged: () => void;
}) {
  const [published, setPublished] = useState(publishedAt != null);
  const [opens, setOpens] = useState<number | null>(opensAt);
  const init = israelParts(opensAt);
  const [date, setDate] = useState(init.date);
  const [time, setTime] = useState(init.time);
  const [phase, setPhase] = useState<Phase>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const isExam = kind === "exam";

  const send = async (publish: boolean) => {
    if (!publish && !window.confirm(isExam ? "לבטל את פרסום המבחן? התלמידים לא יראו אותו." : "לבטל את פרסום דף ההכנה?")) return;
    if (publish && isExam && !window.confirm(`לפרסם את המבחן לתלמידים? הוא ייפתח ב־${date} בשעה ${time}, למשך ${durationMin ?? "?"} דקות.`)) return;
    setPhase("busy");
    setMsg(null);
    try {
      const res = await fetch(`/api/exams/${docId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publish, opensDate: date, opensTime: time }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "לא עודכן");
      setPublished(publish);
      setOpens(data.opensAt ?? null);
      setPhase("done");
      setMsg(publish ? "✓ פורסם לתלמידים" : "✓ הפרסום בוטל. חזר לטיוטה");
      onChanged();
      window.setTimeout(() => setPhase("idle"), 2500);
    } catch (e) {
      setPhase("error");
      setMsg(e instanceof Error ? e.message : "לא עודכן. נסו שוב.");
    }
  };

  const busy = phase === "busy";
  return (
    <section
      className={`rounded-2xl border-2 p-4 ${
        published
          ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/5"
          : "border-dashed border-[color:var(--border)] bg-[color:var(--card)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">
            מצב:{" "}
            {published ? (
              <span className="text-[color:var(--success)]">פורסם לתלמידים</span>
            ) : (
              <span className="text-[color:var(--foreground)]/70">טיוטה (התלמידים לא רואים)</span>
            )}
          </p>
          {published && isExam && opens && (
            <p className="text-sm">נפתח לתלמידים: {fmt(opens)} · {durationMin ?? "?"} דקות מרגע ההתחלה</p>
          )}
          {published && !isExam && <p className="text-sm">מופיע כדף קריאה בעמוד ״הכנות למבחנים״.</p>}
        </div>
        {published ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => send(false)}
            className="rounded-full border-2 border-[color:var(--danger)]/60 px-5 py-2 text-sm font-bold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10 disabled:opacity-60"
          >
            {busy ? "מעדכן…" : "ביטול הפרסום"}
          </button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            {isExam && (
              <>
                <label className="text-xs font-semibold">
                  תאריך פתיחה
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-0.5 block rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm" />
                </label>
                <label className="text-xs font-semibold">
                  שעת פתיחה
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="mt-0.5 block rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm" />
                </label>
              </>
            )}
            <button
              type="button"
              disabled={busy || (isExam && (!date || !time || !durationMin))}
              onClick={() => send(true)}
              className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white shadow transition ${
                busy ? "scale-[0.96] bg-[color:var(--success-fill)] opacity-90" : "bg-[color:var(--success-fill)] hover:scale-[1.03]"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />}
              {busy ? "מפרסם…" : isExam ? "פרסום המבחן לתלמידים" : "פרסום דף ההכנה לתלמידים"}
            </button>
          </div>
        )}
      </div>
      {msg && (
        <p className={`mt-2 text-sm font-semibold ${phase === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--success)]"}`}>
          {msg}
        </p>
      )}
    </section>
  );
}
