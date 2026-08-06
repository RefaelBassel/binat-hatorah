// Sefaria integration — hyper-linking and (later) text fetching, STRICTLY
// scoped to the curriculum: only the chapters in the annual program, and
// only the program's commentators. ספר מלכים is learned pshat-only, so its
// links point to the biblical text alone — no commentators.

// Hebrew-interface Sefaria links.
const SEFARIA_BASE = "https://www.sefaria.org.il";

export function sefariaUrl(ref: string): string {
  return `${SEFARIA_BASE}/${encodeURIComponent(ref).replace(/%2C/g, ",")}?lang=he`;
}

// ---- Curriculum allowlist ----

// חומש במדבר — the chapters in the annual plan (with source units).
export const NUMBERS_CHAPTERS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 19, 20, 21, 25, 27, 28, 32, 36];

// ספר מלכים — the bekiut units (chapters; partial-chapter refs are allowed
// within these chapters).
export const KINGS_I_CHAPTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17, 18, 19, 21];
export const KINGS_II_CHAPTERS = [2, 8, 9, 10, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];

// Commentators in the program — on במדבר only (מלכים is pshat-only).
export const ALLOWED_COMMENTATOR_PREFIXES = [
  "Rashi_on_Numbers.",
  "Ramban_on_Numbers.",
  "Rashbam_on_Numbers.",
  "Sefer_HaChinukh.",
];

// Is this Sefaria ref inside the curriculum scope?
export function isAllowedRef(ref: string): boolean {
  const numbersMatch = ref.match(/^Numbers\.(\d+)/);
  if (numbersMatch) return NUMBERS_CHAPTERS.includes(Number(numbersMatch[1]));

  const kings1 = ref.match(/^I_Kings\.(\d+)/);
  if (kings1) return KINGS_I_CHAPTERS.includes(Number(kings1[1]));
  const kings2 = ref.match(/^II_Kings\.(\d+)/);
  if (kings2) return KINGS_II_CHAPTERS.includes(Number(kings2[1]));

  return ALLOWED_COMMENTATOR_PREFIXES.some((p) => ref.startsWith(p));
}

// Safe URL builder: returns null for refs outside the curriculum, so nothing
// in the UI ever links beyond the program's scope.
export function curriculumUrl(ref: string | undefined): string | null {
  if (!ref || !isAllowedRef(ref)) return null;
  return sefariaUrl(ref);
}

// Server-side text fetch (Sefaria API v3) — for building future tasks and
// on-demand source display. Curriculum-scoped like everything else.
export async function fetchSefariaText(
  ref: string
): Promise<{ he: string[]; ref: string } | null> {
  if (!isAllowedRef(ref)) return null;
  try {
    const res = await fetch(
      `https://www.sefaria.org/api/v3/texts/${encodeURIComponent(ref)}?version=hebrew`,
      { next: { revalidate: 60 * 60 * 24 } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.versions?.[0]?.text;
    const flat: string[] = Array.isArray(text) ? text.flat(3) : [String(text ?? "")];
    return { he: flat.filter(Boolean).map(String), ref };
  } catch {
    return null;
  }
}
