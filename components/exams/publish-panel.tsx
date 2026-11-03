"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton, { postJson } from "./action-button";
import { formatFullDate, formatHebTime } from "@/lib/hebrew";

// Publishing to students. Default is a draft: nothing is visible to students
// until the teacher presses the publish button here. The student copy is the
// saved draft at that moment, without the rubric.
function israelParts(unix: number): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(unix * 1000));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${hour}:${get("minute")}` };
}

export default function PublishPanel({
  examId,
  kind,
  initialStatus,
  initialOpensAt,
  initialDuration,
  attemptCount,
  flush,
  docDuration,
}: {
  examId: number;
  kind: "exam" | "prep";
  initialStatus: "draft" | "published";
  initialOpensAt: number | null;
  initialDuration: number | null;
  attemptCount: number;
  flush: () => Promise<void>;
  docDuration: number | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [opensAt, setOpensAt] = useState(initialOpensAt);
  const initial = initialOpensAt ? israelParts(initialOpensAt) : { date: "", time: "08:00" };
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time);
  const [duration, setDuration] = useState<string>(
    String(initialDuration ?? docDuration ?? 90)
  );
  const published = status === "published";

  const publish = async () => {
    await flush();
    await postJson(`/api/exams/${examId}/publish`, {
      action: "publish",
      opensDate: date,
      opensTime: time,
      durationMin: duration,
    });
    setStatus("published");
    if (kind === "exam") {
      const d = new Date(`${date}T${time}:00`);
      if (!Number.isNaN(d.getTime())) setOpensAt(Math.floor(d.getTime() / 1000));
    }
    router.refresh();
  };

  const unpublish = async () => {
    await postJson(`/api/exams/${examId}/publish`, { action: "unpublish" });
    setStatus("draft");
    router.refresh();
  };

  const field =
    "rounded-md border border-[color:var(--border)] bg-[color:var(--field)] px-2 py-1.5 text-sm outline-none focus:border-[color:var(--accent)]";

  return (
    <section
      className={`rounded-2xl border-2 p-4 ${
        published
          ? "border-[color:var(--success)]/50 bg-[color:var(--success)]/10"
          : "border-[color:var(--border)] bg-[color:var(--card)]"
      }`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <h2 className="font-display text-lg font-extrabold text-[color:var(--primary)]">
          {kind === "prep" ? "פרסום דף ההכנה לתלמידים" : "פרסום המבחן לתלמידים"}
        </h2>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-bold ${
            published
              ? "bg-[color:var(--success-fill)] text-white"
              : "bg-[color:var(--status-not-started-bg)] text-[color:var(--status-not-started)]"
          }`}
        >
          {published ? "פורסם לתלמידים" : "טיוטה — התלמידים לא רואים"}
        </span>
      </div>

      {kind === "prep" ? (
        <p className="mb-3 text-sm leading-6 text-[color:var(--foreground)]/75">
          הדף יופיע לתלמידים כדף קריאה בעמוד ״הכנות למבחנים״, בגרסה השמורה ברגע הפרסום.
          {published && " שינויים מכאן והלאה יגיעו אליהם רק אחרי לחיצה נוספת על ״עדכון הפרסום״."}
        </p>
      ) : (
        <div className="mb-3 space-y-2">
          <p className="text-sm leading-6 text-[color:var(--foreground)]/75">
            התלמידים יראו את המבחן מרגע הפתיחה, בלי המחוון. מי שמתחיל/ה מקבל/ת טיימר לפי הזמן
            שנקבע, והמבחן מוגש אוטומטית כשהזמן נגמר.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-bold">
              תאריך פתיחה
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">
              שעת פתיחה
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-xs font-bold">
              זמן מוגבל (דקות)
              <input
                type="number"
                min={1}
                max={600}
                dir="ltr"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className={`${field} w-24`}
              />
            </label>
          </div>
          {published && opensAt && (
            <p className="text-sm font-semibold text-[color:var(--success)]">
              נפתח ל: {formatFullDate(opensAt)} בשעה {formatHebTime(opensAt)}
              {attemptCount > 0 && ` · ${attemptCount} התחילו`}
            </p>
          )}
          {attemptCount > 0 && published && (
            <p className="text-xs text-[color:var(--foreground)]/65">
              כבר יש תלמידים שהתחילו — נוסח המבחן הפורסם נשאר קבוע, אפשר לשנות רק את המועד והזמן.
            </p>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <ActionButton
          tone="accent"
          busyLabel="מפרסם…"
          doneLabel={published ? "עודכן" : "פורסם!"}
          confirmMessage={
            kind === "prep"
              ? "לפרסם את דף ההכנה לכל התלמידים?"
              : "לפרסם את המבחן? התלמידים יראו אותו מרגע הפתיחה."
          }
          onClick={publish}
        >
          {published
            ? kind === "prep"
              ? "עדכון הפרסום"
              : attemptCount > 0
                ? "עדכון מועד וזמן"
                : "עדכון הפרסום"
            : kind === "prep"
              ? "פרסום דף ההכנה"
              : "פרסום המבחן"}
        </ActionButton>
        {published && (
          <ActionButton
            tone="plain"
            busyLabel="מבטל…"
            doneLabel="חזר לטיוטה"
            confirmMessage="לבטל את הפרסום? התלמידים לא יראו יותר."
            onClick={unpublish}
          >
            ביטול הפרסום
          </ActionButton>
        )}
      </div>
    </section>
  );
}
