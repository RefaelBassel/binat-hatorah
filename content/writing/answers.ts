// Server-only answer keys for the objective writing exercises.
// Imported ONLY by the API route — never shipped to the client.

// tag: sentence id → correct component label (must match COMPONENT_LABELS).
export const TAG_ANSWERS: Record<string, Record<string, string>> = {
  "w1-cats": {
    s1: "טענה",
    s2: "נימוק / ראיה",
    s3: "מסקנה",
  },
  "w1-phones": {
    s1: "נימוק / ראיה",
    s2: "הנחת יסוד סמויה",
    s3: "מסקנה",
    s4: "טענה",
  },
  "w1-pesach": {
    s1: "נימוק / ראיה",
    s2: "טענה",
    s3: "הנחת יסוד סמויה",
  },
};

// mc: exercise key → index of the correct option.
export const MC_ANSWERS: Record<string, number> = {
  "w2-homework": 0,
  "w3-falafel": 0,
};
