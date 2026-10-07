// Browser-side call to /api/grade-assist. Never throws: every outcome —
// a proposal, a Hebrew error from the server, a non-JSON platform error
// page (timeout, crash) or a dropped connection — comes back as a value the
// UI can show.
export type GradeAssistResult =
  | { ok: true; score: number | null; feedback: string }
  | { ok: false; error: string };

export async function requestGradeProposal(
  taskId: number,
  userId: number
): Promise<GradeAssistResult> {
  let res: Response;
  try {
    res = await fetch("/api/grade-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, userId }),
    });
  } catch {
    return { ok: false, error: "אין חיבור לשרת — כדאי לבדוק את החיבור לאינטרנט." };
  }
  const data = await res.json().catch(() => null);
  if (res.ok && data?.available === true) {
    return {
      ok: true,
      score: typeof data.score === "number" ? data.score : null,
      feedback: String(data.feedback ?? ""),
    };
  }
  if (typeof data?.error === "string" && data.error) {
    return { ok: false, error: data.error };
  }
  if (res.status === 504) {
    return { ok: false, error: "הבדיקה לקחה יותר מדי זמן ונקטעה." };
  }
  return { ok: false, error: `הבדיקה נכשלה (קוד ${res.status}).` };
}
