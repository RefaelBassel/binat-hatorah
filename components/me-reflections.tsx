"use client";

// The student's live reflection panel on the personal page: the trend
// chart plus "where am I now vs. where I started" chips. Refreshes softly
// (every 30s and on window focus) so a reflection saved from the drawer
// appears without reloading the page.

import { useEffect, useState } from "react";
import ReflectionTrend, {
  TREND_SERIES,
  type TrendPoint,
} from "./reflection-trend";

export default function MeReflections({
  initialPoints,
}: {
  initialPoints: TrendPoint[];
}) {
  const [points, setPoints] = useState<TrendPoint[]>(initialPoints);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/reflections", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setPoints(d.points);
        })
        .catch(() => {});
    const iv = setInterval(load, 30000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const first = points[0];
  const last = points[points.length - 1];

  return (
    <div>
      {points.length >= 2 && first && last && (
        <div className="mb-3 flex flex-wrap gap-2 text-[11px] font-bold">
          {TREND_SERIES.map((s) => {
            const delta = s.pick(last) - s.pick(first);
            // for difficulty, dropping is the good direction
            const good =
              s.key === "difficulty" ? delta < 0 : delta > 0;
            const arrow = delta === 0 ? "→" : delta > 0 ? "↑" : "↓";
            return (
              <span
                key={s.key}
                className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
                style={{
                  background: `${s.color}14`,
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}: {s.pick(last)}
                <span
                  className={
                    delta === 0
                      ? "opacity-50"
                      : good
                        ? "text-[color:var(--success)]"
                        : "text-[color:var(--warning)]"
                  }
                >
                  {arrow}
                  {delta !== 0 && Math.abs(delta)}
                </span>
              </span>
            );
          })}
        </div>
      )}
      <ReflectionTrend
        points={points}
        emptyHint="בסוף כל שיעור (או בכל רגע, דרך לשונית הרפלקציה בצד) אפשר לספר איך היה — והגרף יצמח כאן 🌱"
      />
    </div>
  );
}
