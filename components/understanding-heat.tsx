"use client";

// Shared pieces of the "understanding pulse": the per-student 1-10 badge
// and the "where the class struggles" heat list. There is deliberately NO
// threshold anywhere — the colour simply deepens towards red as more of
// the class gets a part wrong, so the teacher's eye is drawn, and she
// decides. Used by the pulse drawer, the projected board and the closing
// screen.

export interface WeakSpot {
  part: string;
  wrong: number;
  answered: number;
  wrongPct: number;
}

// 0% wrong → pale, 100% wrong → deep red (background tint capped so text
// stays readable in both themes)
export function heatStyle(wrongPct: number): React.CSSProperties {
  const tint = Math.round(Math.min(100, Math.max(0, wrongPct)) * 0.55 + 4);
  const hue = wrongPct >= 50 ? "var(--danger)" : wrongPct >= 25 ? "var(--warning)" : "var(--success)";
  return {
    background: `color-mix(in srgb, ${wrongPct >= 25 ? "var(--danger)" : "var(--success)"} ${tint}%, var(--card))`,
    color: hue,
  };
}

export function ScoreBadge({ score, big }: { score: number; big?: boolean }) {
  const tone =
    score >= 8
      ? { bg: "color-mix(in srgb, var(--success) 15%, transparent)", fg: "var(--success)" }
      : score >= 5
        ? { bg: "color-mix(in srgb, var(--warning) 16%, transparent)", fg: "var(--warning)" }
        : { bg: "color-mix(in srgb, var(--danger) 14%, transparent)", fg: "var(--danger)" };
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full font-display font-extrabold tabular-nums ${
        big ? "px-3 py-1 text-base" : "px-2 py-0.5 text-[11px]"
      }`}
      style={{ background: tone.bg, color: tone.fg }}
      title="מדד ההבנה מבדיקת ההבנה — נפרד מציון המשימה"
    >
      הבנה {score}/10
    </span>
  );
}

export function UnderstandingHeat({
  weakSpots,
  average,
  count,
  big,
  title = "היכן הכיתה מתקשה",
}: {
  weakSpots: WeakSpot[];
  average: number | null;
  count: number;
  big?: boolean;
  title?: string;
}) {
  if (count === 0) {
    return (
      <p className={`text-[color:var(--primary)]/50 ${big ? "text-base" : "text-[11px]"}`}>
        🌡️ עוד אף אחד לא הגיע לבדיקת ההבנה.
      </p>
    );
  }
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={`font-bold text-[color:var(--primary)]/75 ${big ? "text-lg" : "text-[11px]"}`}>
          🌡️ {title}
        </p>
        <p className={`font-bold tabular-nums text-[color:var(--primary)]/60 ${big ? "text-base" : "text-[10px]"}`}>
          ממוצע {average ?? "—"}/10 · {count} ענו
        </p>
      </div>
      <ul className={big ? "space-y-2" : "space-y-1"}>
        {weakSpots.map((w) => (
          <li
            key={w.part}
            className={`flex items-center justify-between gap-3 rounded-lg font-semibold ${
              big ? "px-4 py-2.5 text-base" : "px-2.5 py-1.5 text-[11px]"
            }`}
            style={heatStyle(w.wrongPct)}
            title={`${w.wrong} מתוך ${w.answered} טעו`}
          >
            <span className="min-w-0 truncate">{w.part}</span>
            <span className="shrink-0 font-extrabold tabular-nums">{w.wrongPct}% טעו</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
