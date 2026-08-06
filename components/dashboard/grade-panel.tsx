"use client";

import { useState } from "react";

// Grading flow: Claude proposes score + feedback → the teacher edits →
// final approval sends the grade to the student (bell + email).
export default function GradePanel({
  taskId,
  studentId,
  studentName,
  initialClaudeScore,
  initialClaudeFeedback,
  initialScore,
  initialFeedback,
  approved: initialApproved,
}: {
  taskId: number;
  studentId: number;
  studentName: string;
  initialClaudeScore: number | null;
  initialClaudeFeedback: string | null;
  initialScore: number | null;
  initialFeedback: string | null;
  approved: boolean;
}) {
  const [claudeScore, setClaudeScore] = useState(initialClaudeScore);
  const [claudeFeedback, setClaudeFeedback] = useState(initialClaudeFeedback);
  const [score, setScore] = useState<string>(
    initialScore != null ? String(initialScore) : ""
  );
  const [feedback, setFeedback] = useState(initialFeedback ?? "");
  const [approved, setApproved] = useState(initialApproved);
  const [busy, setBusy] = useState<"assist" | "save" | "approve" | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const askClaude = async () => {
    setBusy("assist");
    setNote(null);
    try {
      const res = await fetch("/api/grade-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userId: studentId }),
      });
      const data = await res.json();
      if (data.available === false) {
        setNote(data.error ?? "העזרה האוטומטית עוד לא זמינה.");
      } else {
        setClaudeScore(data.score);
        setClaudeFeedback(data.feedback);
        if (!score) setScore(data.score != null ? String(data.score) : "");
        if (!feedback) setFeedback(data.feedback ?? "");
      }
    } catch {
      setNote("שגיאה בחיבור — נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  const save = async (approve: boolean) => {
    setBusy(approve ? "approve" : "save");
    setNote(null);
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          userId: studentId,
          score: Number(score),
          feedback,
          approve,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        if (approve) {
          setApproved(true);
          setNote(`✅ הציון אושר ונשלח ל${studentName} במייל ובפעמון.`);
        } else {
          setNote("נשמר כטיוטה (טרם נשלח לתלמידה).");
        }
      } else setNote(data.error ?? "שגיאה בשמירה.");
    } catch {
      setNote("שגיאה בחיבור — נסו שוב.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border-2 border-[color:var(--accent)]/40 bg-[color:var(--card)] p-5">
      <h2 className="mb-4 font-display text-base font-bold text-[color:var(--primary)]">
        🏅 בדיקה וציון {approved && <span className="text-[color:var(--success)]">· אושר ✓</span>}
      </h2>

      {/* Claude's proposal */}
      <div className="mb-4 rounded-xl bg-[color:var(--primary)]/5 p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-bold text-[color:var(--primary)]">✨ ההצעה של קלוד</p>
          <button
            onClick={askClaude}
            disabled={busy !== null}
            className="rounded-full bg-[color:var(--primary)] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === "assist" ? "קלוד בודק..." : claudeScore != null ? "בדיקה מחדש" : "בקשת הצעת ציון והערכה"}
          </button>
        </div>
        {claudeScore != null || claudeFeedback ? (
          <>
            {claudeScore != null && (
              <p className="text-sm font-bold text-[color:var(--primary)]">
                ציון מוצע: {claudeScore}
              </p>
            )}
            {claudeFeedback && (
              <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[color:var(--foreground)]/80">
                {claudeFeedback}
              </p>
            )}
          </>
        ) : (
          <p className="text-xs text-[color:var(--primary)]/50">
            קלוד יציע ציון והערכה — המורה עורך/ת ומאשר/ת סופית.
          </p>
        )}
      </div>

      {/* teacher's final */}
      <div className="grid gap-3 sm:grid-cols-[110px_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            ציון סופי
          </span>
          <input
            type="number"
            min={0}
            max={100}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-center text-lg font-bold"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">
            הערכה מילולית (נשלחת לתלמיד/ה)
          </span>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-sm leading-6"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => save(false)}
          disabled={busy !== null || !score}
          className="rounded-full border border-[color:var(--border)] px-5 py-2 text-sm font-semibold text-[color:var(--primary)] disabled:opacity-40"
        >
          שמירת טיוטה
        </button>
        <button
          onClick={() => save(true)}
          disabled={busy !== null || !score}
          className="rounded-full bg-[color:var(--success)] px-6 py-2 text-sm font-bold text-white shadow disabled:opacity-40"
        >
          {busy === "approve" ? "שולחים..." : "אישור סופי ושליחה לתלמיד/ה 📨"}
        </button>
        {note && <p className="text-xs text-[color:var(--primary)]/70">{note}</p>}
      </div>
    </section>
  );
}
