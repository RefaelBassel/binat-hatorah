// Browser-side call to /api/grade-assist, shared by the single-submission
// grade panel and the dashboard's batch run. Never throws: every outcome —
// including a platform timeout page that isn't JSON — becomes either a
// proposal or a Hebrew explanation the teacher can act on.
export type GradeProposalResult =
  | { ok: true; score: number | null; feedback: string }
  | { ok: false; error: string; retryable: boolean };

export async function requestGradeProposal(
  taskId: number,
  userId: number
): Promise<GradeProposalResult> {
  let res: Response;
  try {
    res = await fetch("/api/grade-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskId, userId }),
    });
  } catch {
    return {
      ok: false,
      error: "הדפדפן לא הצליח להגיע לשרת. כדאי לבדוק את החיבור לאינטרנט ולנסות שוב.",
      retryable: true,
    };
  }

  let data: {
    available?: boolean;
    score?: number | null;
    feedback?: string;
    error?: string;
    retryable?: boolean;
  } | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (data?.error || data?.available === false) {
    return {
      ok: false,
      error: data.error ?? "העזרה האוטומטית עוד לא זמינה.",
      retryable: data.available !== false && data.retryable !== false,
    };
  }
  if (res.ok && data?.feedback) {
    return { ok: true, score: data.score ?? null, feedback: data.feedback };
  }
  if (res.status === 504) {
    return {
      ok: false,
      error: "הבדיקה לקחה יותר מהזמן שהשרת מאפשר ונעצרה לפני שהסתיימה. אפשר לנסות שוב.",
      retryable: true,
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      ok: false,
      error: "נראה שההתחברות לאתר פגה. כדאי לרענן את הדף, להתחבר מחדש ולנסות שוב.",
      retryable: false,
    };
  }
  return {
    ok: false,
    error: `השרת החזיר תקלה (קוד ${res.status}) ולא נשמרה הצעה. אפשר לנסות שוב.`,
    retryable: true,
  };
}
