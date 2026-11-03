"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ExamSheet } from "./doc-view";
import ActionButton, { postJson } from "./action-button";
import AutoTextarea from "./auto-textarea";
import { formatWorkTime } from "@/lib/hebrew";
import type { ExamDoc } from "@/lib/exams-types";

type Save = "saved" | "pending" | "saving" | "error";

// The student's exam screen: the questions with an answer box under each, a
// countdown to the deadline fixed by the server, autosave, and submit. When
// the clock reaches zero the answers are submitted automatically.
export default function ExamTaker({
  examId,
  title,
  doc,
  initialAnswers,
  deadlineAt,
  serverNow,
}: {
  examId: number;
  title: string;
  doc: ExamDoc;
  initialAnswers: Record<string, string>;
  deadlineAt: number; // unix seconds
  serverNow: number; // unix seconds when the page was rendered
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(initialAnswers);
  const [save, setSave] = useState<Save>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  // the browser clock may be off: measure against the server's time
  const offsetMs = useRef(serverNow * 1000 - Date.now());
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, deadlineAt - serverNow)
  );
  const [timeUp, setTimeUp] = useState(deadlineAt <= serverNow);
  const latest = useRef(answers);
  const savedJson = useRef(JSON.stringify(initialAnswers));
  const timer = useRef<number | null>(null);
  const submitted = useRef(false);

  const saveNow = async () => {
    const snapshot = JSON.stringify(latest.current);
    if (snapshot === savedJson.current) return;
    setSave("saving");
    try {
      await postJson(`/api/exams/${examId}/attempt`, { action: "save", answers: latest.current });
      savedJson.current = snapshot;
      setSave(JSON.stringify(latest.current) === snapshot ? "saved" : "pending");
      setSaveError(null);
    } catch (e) {
      setSave("error");
      setSaveError(e instanceof Error ? e.message : "השמירה נכשלה");
    }
  };

  const change = (key: string, value: string) => {
    const next = { ...latest.current, [key]: value };
    latest.current = next;
    setAnswers(next);
    setSave("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void saveNow(), 1500);
  };

  const submit = async () => {
    if (timer.current) window.clearTimeout(timer.current);
    submitted.current = true;
    try {
      await postJson(`/api/exams/${examId}/attempt`, { action: "submit", answers: latest.current });
    } catch (e) {
      submitted.current = false;
      throw e;
    }
    savedJson.current = JSON.stringify(latest.current);
    router.refresh();
  };

  // countdown
  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, Math.ceil((deadlineAt * 1000 - (Date.now() + offsetMs.current)) / 1000));
      setRemaining(left);
      if (left === 0) setTimeUp(true);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [deadlineAt]);

  // time is up → submit by itself (retry a few times if the network hiccups)
  useEffect(() => {
    if (!timeUp || submitted.current) return;
    let cancelled = false;
    (async () => {
      for (let i = 0; i < 4 && !cancelled && !submitted.current; i++) {
        try {
          await submit();
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // submit only reads refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeUp]);

  // leaving with unsaved answers
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(latest.current) !== savedJson.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const low = remaining <= 300;
  const saveText =
    save === "saving"
      ? "שומר…"
      : save === "pending"
        ? "ממתין לשמירה…"
        : save === "error"
          ? `${saveError ?? "השמירה נכשלה"} — ממשיכים לכתוב, ננסה שוב`
          : "התשובות נשמרות אוטומטית";

  return (
    <div className="space-y-4">
      <div
        className={`sticky top-[var(--exam-sticky,4.25rem)] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 shadow-md ${
          low
            ? "border-[color:var(--danger)] bg-[color:var(--status-overdue-bg)]"
            : "border-[color:var(--primary)]/30 bg-[color:var(--card)]"
        }`}
      >
        <div role="timer" aria-live="off" className="flex items-baseline gap-2">
          <span className="text-sm font-bold">זמן שנותר:</span>
          <span
            dir="ltr"
            className={`font-display text-3xl font-extrabold tabular-nums ${
              low ? "text-[color:var(--danger)]" : "text-[color:var(--primary)]"
            }`}
          >
            {formatWorkTime(remaining)}
          </span>
        </div>
        <span
          className={`text-xs font-semibold ${save === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--foreground)]/60"}`}
          role="status"
        >
          {saveText}
        </span>
        <ActionButton
          tone="accent"
          busyLabel="מגיש…"
          doneLabel="הוגש!"
          disabled={timeUp}
          confirmMessage="להגיש את המבחן? אחרי ההגשה אי אפשר לשנות."
          onClick={submit}
        >
          הגשת המבחן
        </ActionButton>
      </div>

      {timeUp && (
        <p className="rounded-xl bg-[color:var(--status-overdue-bg)] p-3 text-sm font-bold text-[color:var(--danger)]">
          הזמן נגמר — המבחן מוגש אוטומטית עם מה שנכתב עד עכשיו…
        </p>
      )}

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-5 py-6 sm:px-8">
        <ExamSheet
          doc={doc}
          title={title}
          renderAnswer={(key) => (
            <div className="mt-2">
              <AutoTextarea
                value={answers[key] ?? ""}
                onChange={(v) => change(key, v)}
                minRows={4}
                readOnly={timeUp}
                ariaLabel="התשובה שלך"
                placeholder="כתבו כאן את התשובה"
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
