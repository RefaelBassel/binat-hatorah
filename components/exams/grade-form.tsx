"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ActionButton, { postJson } from "./action-button";
import SaveButton from "@/components/save-button";
import AutoTextarea from "./auto-textarea";
import { type ExamDoc, examTotal, scoreFromUnitPoints } from "@/lib/exams-types";

type Unit = { key: string; label: string; text: string; rubric: string; max: number | null };

// Grading screen: the student's answers next to the rubric, a points box per
// question (pre-filled by the automatic check when it ran), live total, and an
// approval button. An exam gets a NUMERIC score — nothing reaches the student
// until the teacher approves.
export default function GradeForm({
  examId,
  attemptId,
  units,
  doc,
  answers,
  submitted,
  initialScores,
  scoresAreFromClaude,
  claudeError,
  initialFeedback,
  approvedAt,
  approvedScore,
}: {
  examId: number;
  attemptId: number;
  units: Unit[];
  doc: ExamDoc;
  answers: Record<string, string>;
  submitted: boolean;
  initialScores: Record<string, number>;
  scoresAreFromClaude: boolean;
  claudeError: string | null;
  initialFeedback: string;
  approvedAt: number | null;
  approvedScore: number | null;
}) {
  const router = useRouter();
  const [scores, setScores] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(initialScores).map(([k, v]) => [k, String(v)]))
  );
  const [feedback, setFeedback] = useState(initialFeedback);
  const [savedKey, setSavedKey] = useState(JSON.stringify([scores, feedback]));
  const [approved, setApproved] = useState(approvedAt !== null);
  const dirty = JSON.stringify([scores, feedback]) !== savedKey;

  const numeric: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) if (v !== "") numeric[k] = Number(v);
  const total = scoreFromUnitPoints(doc, numeric);
  const maxTotal = examTotal(doc);

  const payload = (action: "save" | "approve") => ({
    attemptId,
    action,
    scores: numeric,
    feedback,
  });

  return (
    <div className="space-y-4">
      {!submitted && (
        <p className="rounded-xl bg-[color:var(--warning)]/15 p-3 text-sm font-bold text-[color:var(--warning)]">
          המבחן עוד לא הוגש — אפשר לבדוק רק אחרי ההגשה.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <ActionButton
          tone="accent"
          busyLabel="Claude בודק…"
          doneLabel="ההצעה מוכנה"
          disabled={!submitted}
          confirmMessage={
            dirty ? "הבדיקה האוטומטית תחליף את המספרים שבמסך. להמשיך?" : undefined
          }
          onClick={async () => {
            await postJson(`/api/exams/${examId}/grade`, { attemptId, action: "assist" });
            // the form's numbers come from the server render — reload to show the proposal
            window.location.reload();
          }}
        >
          🤖 בדיקה אוטומטית לפי המחוון
        </ActionButton>
        {scoresAreFromClaude && (
          <span className="text-xs font-bold text-[color:var(--info)]">
            המספרים הם הצעה של Claude — לערוך ולאשר.
          </span>
        )}
        {claudeError && (
          <span className="text-xs font-bold text-[color:var(--danger)]">{claudeError}</span>
        )}
      </div>

      <ul className="space-y-4">
        {units.map((u) => (
          <li
            key={u.key}
            className="space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4"
          >
            <p className="whitespace-pre-wrap font-bold text-[color:var(--primary)]">
              {u.label}. {u.text}
            </p>
            <div className="whitespace-pre-wrap rounded-lg bg-[color:var(--background)] p-3 text-sm leading-7">
              {answers[u.key]?.trim() ? answers[u.key] : <i className="opacity-60">לא נענתה</i>}
            </div>
            {u.rubric.trim() && (
              <div className="whitespace-pre-wrap rounded-lg border border-dashed border-[color:var(--warning)]/60 bg-[color:var(--warning)]/10 p-2 text-xs leading-6">
                <b>מחוון: </b>
                {u.rubric}
              </div>
            )}
            <label className="inline-flex items-center gap-2 text-sm font-bold">
              ניקוד{u.max !== null ? ` (מתוך ${u.max})` : ""}:
              <input
                type="number"
                min={0}
                max={u.max ?? undefined}
                step="any"
                dir="ltr"
                value={scores[u.key] ?? ""}
                onChange={(e) => setScores({ ...scores, [u.key]: e.target.value })}
                className="w-24 rounded-md border border-[color:var(--border)] bg-[color:var(--field)] px-2 py-1 text-center outline-none focus:border-[color:var(--accent)]"
              />
            </label>
          </li>
        ))}
      </ul>

      <div className="space-y-3 rounded-2xl border-2 border-[color:var(--primary)]/25 bg-[color:var(--card)] p-4">
        <p className="font-display text-xl font-extrabold text-[color:var(--primary)]">
          הציון: {total} מתוך {maxTotal}
          {approved && (
            <span className="ms-3 rounded-full bg-[color:var(--success-fill)] px-3 py-0.5 text-xs text-white">
              אושר ונשלח לתלמיד/ה{approvedScore !== null ? ` (${approvedScore})` : ""}
            </span>
          )}
        </p>
        <label className="block text-sm font-bold">משוב לתלמיד/ה</label>
        <AutoTextarea value={feedback} onChange={setFeedback} minRows={4} ariaLabel="משוב לתלמיד/ה" />
        <div className="flex flex-wrap items-center gap-4">
          <SaveButton
            dirty={dirty}
            label="שמירת טיוטה"
            idleLabel="הטיוטה שמורה"
            onSave={async () => {
              await postJson(`/api/exams/${examId}/grade`, payload("save"));
              setSavedKey(JSON.stringify([scores, feedback]));
            }}
          />
          <ActionButton
            tone="primary"
            busyLabel="מאשר ושולח…"
            doneLabel="אושר ונשלח!"
            disabled={!submitted}
            confirmMessage={`לאשר את הציון ${total} ולשלוח לתלמיד/ה (התראה + מייל)?`}
            onClick={async () => {
              await postJson(`/api/exams/${examId}/grade`, payload("approve"));
              setSavedKey(JSON.stringify([scores, feedback]));
              setApproved(true);
              router.refresh();
            }}
          >
            {approved ? "עדכון ושליחה מחדש" : "אישור הציון ושליחה לתלמיד/ה"}
          </ActionButton>
        </div>
      </div>
    </div>
  );
}
