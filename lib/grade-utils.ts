// Rescue for grade proposals that were stored as a raw JSON blob.
//
// The original grade-assist flow asked Claude for JSON in prose and parsed
// it with JSON.parse over a string slice — which broke whenever the
// feedback contained a quote mark or a literal newline, dumping the whole
// raw blob (score included) into the teacher's feedback box. The endpoint
// now uses forced tool-use (structured output, no text parsing), but rows
// written by the old path may still exist — this cleans them on display.

export function salvageGradeProposal(
  raw: string,
  storedScore: number | null
): { score: number | null; feedback: string } {
  const cleaned = (s: string) =>
    s
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/\*\*/g, "")
      .trim();

  const looksLikeBlob =
    /"score"\s*:/.test(raw) && /"feedback"\s*:/.test(raw);
  if (!looksLikeBlob) {
    return { score: storedScore, feedback: cleaned(raw) };
  }

  // strict parse first (some blobs are valid JSON that simply never got parsed)
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start !== -1 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1));
      const score = Number.isFinite(Number(parsed.score))
        ? Math.min(100, Math.max(0, Math.round(Number(parsed.score))))
        : storedScore;
      return { score, feedback: cleaned(String(parsed.feedback ?? "")) };
    }
  } catch {
    // fall through to the tolerant extraction
  }

  const scoreMatch = raw.match(/"score"\s*:\s*(\d{1,3})/);
  const score = scoreMatch
    ? Math.min(100, Math.max(0, Number(scoreMatch[1])))
    : storedScore;
  const fbMatch = raw.match(/"feedback"\s*:\s*"([\s\S]*?)"?\s*\}?\s*$/);
  const feedback = cleaned(fbMatch ? fbMatch[1] : raw);
  return { score, feedback };
}
