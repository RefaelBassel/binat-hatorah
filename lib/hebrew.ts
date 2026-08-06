// Hebrew date/time helpers. UI shows Hebrew months with Gregorian parallel.

const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

export function formatHebDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const heb = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
  }).format(d);
  const greg = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
  }).format(d);
  return `${heb} (${greg})`;
}

export function formatFullDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const day = DAY_NAMES[d.getDay()];
  const heb = new Intl.DateTimeFormat("he-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  const greg = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).format(d);
  return `יום ${day}, ${heb} · ${greg}`;
}

export function formatWorkTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Strip nikud + taamim for word comparison (leitwort matching).
export function stripNikud(text: string): string {
  return text.replace(/[֑-ׇ]/g, "");
}
