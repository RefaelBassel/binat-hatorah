"use client";

import { useEffect, useState } from "react";
import type { PassageVerse, PlenaryQuestion } from "@/content/tasks/types";
import { UnderstandingHeat, heatStyle, type WeakSpot } from "./understanding-heat";
import { PlenaryEditor } from "./task/thinking-card";

// The teacher's closing console. Live understanding picture on top; two
// ready paths side by side; either one projects full-screen. There is no
// threshold and no automatic branch — the colour draws the eye, she decides.
interface Status {
  hasCheck?: boolean;
  classCheckAvg?: number | null;
  checkCount?: number;
  weakSpots?: WeakSpot[];
  students: { status: string }[];
}

type Projection = null | { kind: "review" } | { kind: "plenary" };

export default function ClosingConsole({
  taskId,
  contentRef,
  title,
  bookRef,
  hasCheck,
  plenary,
  studentQuestions,
  verses,
  passageRef,
}: {
  taskId: number;
  contentRef: string;
  title: string;
  bookRef: string;
  hasCheck: boolean;
  plenary: PlenaryQuestion | null;
  studentQuestions: { question: string; name: string }[];
  verses: PassageVerse[];
  passageRef: string;
}) {
  const [status, setStatus] = useState<Status | null>(null);
  const [aid, setAid] = useState<string | null>(null);
  const [aidBusy, setAidBusy] = useState(false);
  const [aidErr, setAidErr] = useState<string | null>(null);
  const [projection, setProjection] = useState<Projection>(null);
  const [editingPlenary, setEditingPlenary] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/tasks/${taskId}/class-status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setStatus(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 6000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [taskId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (projection) setProjection(null);
        else window.location.href = `/dashboard/task/${taskId}`;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [projection, taskId]);

  const weak = status?.weakSpots ?? [];
  const worst = weak.find((w) => w.wrongPct > 0) ?? null;
  const count = status?.checkCount ?? 0;

  const fetchAid = async () => {
    setAidBusy(true);
    setAidErr(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/review-aid`, { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error ?? "לא הצלחתי להכין עזר-חזרה");
      setAid(d.text);
    } catch (e) {
      setAidErr(e instanceof Error ? e.message : "משהו השתבש");
    } finally {
      setAidBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-6 sm:px-10" style={{ background: "var(--background)" }}>
      <a
        href={`/dashboard/task/${taskId}`}
        title="חזרה לעמוד המשימה (או Esc)"
        aria-label="יציאה ממסך הסגירה"
        className="fixed top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-bold text-[color:var(--primary)]/70 opacity-50 shadow-sm transition hover:opacity-100"
        style={{ insetInlineEnd: 12 }}
      >
        ✕
      </a>

      <header className="mb-6">
        <p className="mb-1 text-[11px] font-semibold tracking-[0.25em] text-[color:var(--accent)]">
          מסך הסגירה · למורה בלבד
        </p>
        <h1 className="font-display text-3xl font-extrabold text-[color:var(--primary)]">{title}</h1>
        <p className="mt-1 text-sm text-[color:var(--primary)]/60">{bookRef}</p>
      </header>

      {/* the live picture */}
      {hasCheck ? (
        <div
          className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4"
          style={
            worst
              ? { ...heatStyle(worst.wrongPct), borderColor: "transparent" }
              : { background: "var(--card)", borderColor: "var(--border)", color: "var(--success)" }
          }
        >
          <p className="text-base font-bold">
            🌡️{" "}
            {status == null
              ? "טוען את תמונת ההבנה…"
              : count === 0
                ? "עוד אף אחד לא הגיע לבדיקת ההבנה."
                : worst
                  ? `${worst.wrongPct}% מהכיתה התקשו ב: ${worst.part}`
                  : "הכיתה ענתה נכון על הכל — אפשר לסגור על שאלת המליאה."}
          </p>
          {status && count > 0 && (
            <p className="text-sm font-bold tabular-nums opacity-80">
              ממוצע {status.classCheckAvg ?? "—"}/10 · {count} ענו
            </p>
          )}
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-5 py-4 text-sm text-[color:var(--primary)]/60">
          למשימה זו אין עדיין בדיקת הבנה — הסגירה היא שאלת המליאה.
        </div>
      )}

      <p className="mb-4 text-center text-sm font-semibold text-[color:var(--primary)]/60">
        את מחליטה איך לסגור. שני הכיוונים מוכנים:
      </p>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* path A: re-teach */}
        <section className="flex flex-col rounded-2xl border-2 border-[color:var(--warning)]/50 bg-[color:var(--card)] p-5">
          <h2 className="font-display text-xl font-extrabold text-[color:var(--warning)]">
            🔁 לחזור על החומר הקשה
          </h2>
          {hasCheck && weak.length > 0 ? (
            <div className="mt-3">
              <UnderstandingHeat
                weakSpots={weak.slice(0, 4)}
                average={status?.classCheckAvg ?? null}
                count={count}
                title="החלקים לפי קושי"
              />
            </div>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--primary)]/55">
              {hasCheck ? "עדיין אין תוצאות מהצ'ק." : "אין צ'ק במשימה הזו."}
            </p>
          )}

          <div className="mt-4 rounded-xl border border-dashed border-[color:var(--border)] bg-[color:var(--background)] p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[color:var(--primary)]/70">
                עזר-חזרה (לך בלבד — לא לתלמידים)
              </p>
              <button
                type="button"
                onClick={fetchAid}
                disabled={aidBusy || !hasCheck || count === 0}
                className="rounded-full bg-[color:var(--warning)] px-3 py-1 text-xs font-bold text-white transition hover:scale-[1.03] disabled:opacity-40 disabled:hover:scale-100"
              >
                {aidBusy ? "מכין…" : aid ? "לרענן" : "✨ להכין עזר-חזרה"}
              </button>
            </div>
            {aid ? (
              <div className="space-y-1.5 text-sm leading-7">
                {aid.split("\n").filter(Boolean).map((line, i) => {
                  const m = line.match(/^([^:]{2,24}):\s*(.*)$/);
                  return (
                    <p key={i}>
                      {m ? (
                        <>
                          <b className="text-[color:var(--primary)]">{m[1]}:</b> {m[2]}
                        </>
                      ) : (
                        line
                      )}
                    </p>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[color:var(--primary)]/45">
                ארבע שורות: הפסוק · הקריאה השגויה הסבירה · זווית מבהירה · שאלה לכיתה.
              </p>
            )}
            {aidErr && <p className="mt-1 text-xs text-[color:var(--danger)]">{aidErr}</p>}
          </div>

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={() => setProjection({ kind: "review" })}
              disabled={!worst}
              className="w-full rounded-full border-2 border-[color:var(--warning)] px-5 py-2.5 text-sm font-bold text-[color:var(--warning)] transition hover:bg-[color:var(--warning)]/10 disabled:opacity-40"
            >
              🖥️ להקרין את הפסוקים של החלק הקשה
            </button>
          </div>
        </section>

        {/* path B: plenary */}
        <section className="flex flex-col rounded-2xl border-2 border-[color:var(--primary)]/40 bg-[color:var(--card)] p-5">
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-display text-xl font-extrabold text-[color:var(--primary)]">
              💬 שאלת המליאה
            </h2>
            {!editingPlenary && (
              <button
                type="button"
                onClick={() => setEditingPlenary(true)}
                className="shrink-0 rounded-full border border-dashed border-[color:var(--primary)]/40 px-3 py-1 text-[11px] font-bold text-[color:var(--primary)]/70 transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
              >
                ✏️ עריכה
              </button>
            )}
          </div>
          {editingPlenary ? (
            <PlenaryEditor
              contentRef={contentRef}
              initial={plenary}
              onClose={() => setEditingPlenary(false)}
            />
          ) : plenary ? (
            <blockquote className="mt-3 rounded-xl border-s-4 border-[color:var(--primary)] bg-[color:var(--background)] px-4 py-3 text-lg font-semibold leading-8">
              {plenary.question}
            </blockquote>
          ) : (
            <p className="mt-3 text-sm text-[color:var(--warning)]">
              עוד לא נכתבה שאלת מליאה למשימה זו — לחצי על ״עריכה״.
            </p>
          )}
          <span className="mt-2 inline-block w-fit rounded-full bg-[color:var(--success)]/12 px-2.5 py-0.5 text-[10px] font-bold text-[color:var(--success)]">
            ה-AI לא נוגע בה — שלך ושל הכיתה
          </span>

          <div className="mt-4">
            <p className="mb-1.5 text-xs font-bold text-[color:var(--primary)]/70">
              השאלות שהתלמידים שאלו במשימה ({studentQuestions.length})
            </p>
            {studentQuestions.length === 0 ? (
              <p className="text-xs text-[color:var(--primary)]/45">עוד לא נשמרו שאלות במאגר.</p>
            ) : (
              <ul className="max-h-56 space-y-1 overflow-y-auto pe-1">
                {studentQuestions.map((q, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-sm"
                  >
                    <span className="text-[color:var(--foreground)]">{q.question}</span>
                    <span className="ms-2 text-[11px] text-[color:var(--primary)]/55">— {q.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-auto pt-4">
            <button
              type="button"
              onClick={() => setProjection({ kind: "plenary" })}
              disabled={!plenary}
              className="w-full rounded-full bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
            >
              🖥️ להקרין את שאלת המליאה
            </button>
          </div>
        </section>
      </div>

      <p className="mt-6 text-center text-xs text-[color:var(--primary)]/45">
        אין החלטה אוטומטית — הצבע רק מושך את העין. שני הכיוונים תמיד מוכנים בידך. Esc ליציאה.
      </p>

      {/* full-screen projection */}
      {projection && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center px-10 py-12 text-center"
          style={{ background: "var(--background)" }}
          onClick={() => setProjection(null)}
        >
          <button
            type="button"
            aria-label="סגירת ההקרנה"
            className="fixed top-3 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-bold text-[color:var(--primary)]/70 opacity-50 hover:opacity-100"
            style={{ insetInlineEnd: 12 }}
          >
            ✕
          </button>
          {projection.kind === "plenary" && plenary ? (
            <>
              <p className="mb-6 text-lg font-semibold tracking-[0.2em] text-[color:var(--accent)]">
                💬 לדיון
              </p>
              <p className="max-w-4xl font-display text-4xl font-extrabold leading-snug text-[color:var(--primary)] sm:text-5xl">
                {plenary.question}
              </p>
            </>
          ) : (
            <>
              <p className="mb-2 text-lg font-semibold tracking-[0.2em] text-[color:var(--warning)]">
                🔁 חוזרים לפסוקים
              </p>
              {worst && (
                <p className="mb-6 text-xl font-bold text-[color:var(--primary)]/70">{worst.part}</p>
              )}
              <p className="mb-3 text-sm text-[color:var(--primary)]/50">{passageRef}</p>
              <div className="max-w-5xl text-start font-display text-2xl leading-[2.1] text-[color:var(--foreground)] sm:text-3xl">
                {verses.map((v) => (
                  <span key={v.num}>
                    <span className="me-1 text-base text-[color:var(--accent)]">({v.num})</span>
                    {v.text}{" "}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
