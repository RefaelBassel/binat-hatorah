"use client";

// The reflection trend chart — smooth RTL lines for the two core skills
// plus the difficulty feel, on the 1-10 slider scale. One shared scale,
// equal-step x (one step per reflection; session data, not wall-clock),
// hover crosshair with a Hebrew tooltip, gradient area under the skill
// lines, and a compact "mini" variant for the teacher's per-student grid.
//
// Series colors are chart-grade variants of the site palette, validated
// for lightness, chroma, CVD separation and surface contrast:
//   pshat #3f8a5f · argument #7c5ba6 · difficulty #c06b32

import { useMemo, useRef, useState } from "react";

export interface TrendPoint {
  t: number; // unix seconds
  difficulty: number;
  pshat: number;
  argument: number;
  note?: string | null;
  contextRef?: string | null;
}

export const TREND_SERIES = [
  { key: "pshat", label: "📖 פענוח הפשט", color: "#3f8a5f", pick: (p: TrendPoint) => p.pshat },
  { key: "argument", label: "⚖️ מיומנות הטיעון", color: "#7c5ba6", pick: (p: TrendPoint) => p.argument },
  { key: "difficulty", label: "🌡️ רמת הקושי", color: "#c06b32", pick: (p: TrendPoint) => p.difficulty },
] as const;

// Catmull-Rom → cubic bezier, clamped to the value domain by monotone x steps.
function smoothPath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const x0 = xs[Math.max(0, i - 1)], y0 = ys[Math.max(0, i - 1)];
    const x1 = xs[i], y1 = ys[i];
    const x2 = xs[i + 1], y2 = ys[i + 1];
    const x3 = xs[Math.min(n - 1, i + 2)], y3 = ys[Math.min(n - 1, i + 2)];
    const c1x = x1 + (x2 - x0) / 6, c1y = y1 + (y2 - y0) / 6;
    const c2x = x2 - (x3 - x1) / 6, c2y = y2 - (y3 - y1) / 6;
    d += ` C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${x2},${y2}`;
  }
  return d;
}

function hebDate(t: number, withYear = false): string {
  return new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "numeric",
    ...(withYear ? { year: "2-digit" } : {}),
    timeZone: "Asia/Jerusalem",
  }).format(new Date(t * 1000));
}

export default function ReflectionTrend({
  points,
  mini = false,
  emptyHint,
}: {
  points: TrendPoint[];
  mini?: boolean;
  emptyHint?: string;
}) {
  const W = mini ? 280 : 640;
  const H = mini ? 96 : 230;
  const PAD_X = mini ? 8 : 34;
  const PAD_TOP = mini ? 8 : 14;
  const PAD_BOT = mini ? 8 : 30;
  const [hover, setHover] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const geom = useMemo(() => {
    const n = points.length;
    const innerW = W - PAD_X * 2;
    const xs = points.map((_, i) =>
      // RTL: first reflection on the right
      n === 1 ? W / 2 : W - PAD_X - (i * innerW) / (n - 1)
    );
    const y = (v: number) =>
      H - PAD_BOT - ((v - 1) / 9) * (H - PAD_TOP - PAD_BOT);
    return { xs, y };
  }, [points, W, H, PAD_X, PAD_TOP, PAD_BOT]);

  if (points.length === 0) {
    return (
      <p className="rounded-xl bg-[color:var(--background)] px-4 py-6 text-center text-xs leading-6 text-[color:var(--foreground)]/55">
        {emptyHint ?? "עדיין אין רפלקציות — הגרף יצמח כאן 🌱"}
      </p>
    );
  }

  const { xs, y } = geom;
  const gridVals = [1, 4, 7, 10];
  // ~4 date ticks, always including first and last
  const tickIdx =
    points.length <= 4
      ? points.map((_, i) => i)
      : [0, Math.round((points.length - 1) / 3), Math.round((2 * (points.length - 1)) / 3), points.length - 1];

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = (e.target as SVGRectElement).getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < xs.length; i++) {
      if (Math.abs(xs[i] - px) < Math.abs(xs[best] - px)) best = i;
    }
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  // tooltip sits on the side of the crosshair with more room
  const tipLeftPct = hover != null ? (xs[hover] / W) * 100 : 0;

  return (
    <div ref={wrapRef} className="relative" dir="rtl">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="גרף מגמת הרפלקציות"
      >
        <defs>
          <linearGradient id="rt-area-p" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f8a5f" stopOpacity="0.16" />
            <stop offset="1" stopColor="#3f8a5f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="rt-area-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#7c5ba6" stopOpacity="0.14" />
            <stop offset="1" stopColor="#7c5ba6" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* recessive grid */}
        {gridVals.map((v) => (
          <g key={v}>
            <line
              x1={PAD_X}
              x2={W - PAD_X}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            {!mini && (
              <text
                x={W - PAD_X + 6}
                y={y(v) + 3.5}
                fontSize="9"
                fill="var(--foreground)"
                opacity="0.45"
              >
                {v}
              </text>
            )}
          </g>
        ))}

        {/* area fills under the two skill lines */}
        {points.length > 1 && (
          <>
            <path
              d={`${smoothPath(xs, points.map((p) => y(p.pshat)))} L${xs[xs.length - 1]},${y(1)} L${xs[0]},${y(1)} Z`}
              fill="url(#rt-area-p)"
            />
            <path
              d={`${smoothPath(xs, points.map((p) => y(p.argument)))} L${xs[xs.length - 1]},${y(1)} L${xs[0]},${y(1)} Z`}
              fill="url(#rt-area-a)"
            />
          </>
        )}

        {/* crosshair */}
        {hover != null && !mini && (
          <line
            x1={xs[hover]}
            x2={xs[hover]}
            y1={PAD_TOP}
            y2={H - PAD_BOT}
            stroke="var(--foreground)"
            strokeWidth="1"
            opacity="0.25"
            strokeDasharray="3 3"
          />
        )}

        {/* series lines + markers with a surface ring */}
        {TREND_SERIES.map((s) => (
          <g key={s.key}>
            <path
              d={smoothPath(xs, points.map((p) => y(s.pick(p))))}
              fill="none"
              stroke={s.color}
              strokeWidth={mini ? 2 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={s.key === "difficulty" ? "5 4" : undefined}
              opacity={s.key === "difficulty" ? 0.75 : 1}
            />
            {points.map((p, i) => (
              <circle
                key={i}
                cx={xs[i]}
                cy={y(s.pick(p))}
                r={mini ? 2.5 : hover === i ? 5.5 : 4}
                fill={s.color}
                stroke="var(--card)"
                strokeWidth={mini ? 1 : 2}
              />
            ))}
          </g>
        ))}

        {/* date ticks */}
        {!mini &&
          tickIdx.map((i) => (
            <text
              key={i}
              x={xs[i]}
              y={H - 8}
              fontSize="9.5"
              textAnchor="middle"
              fill="var(--foreground)"
              opacity="0.5"
            >
              {hebDate(points[i].t)}
            </text>
          ))}

        {/* hover capture */}
        {!mini && (
          <rect
            x={0}
            y={0}
            width={W}
            height={H}
            fill="transparent"
            onMouseMove={onMove}
            onMouseLeave={() => setHover(null)}
          />
        )}
      </svg>

      {/* tooltip */}
      {hp && !mini && (
        <div
          className="pointer-events-none absolute z-10 w-44 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-[11px] leading-5 shadow-lg"
          style={{
            top: 6,
            ...(tipLeftPct > 50
              ? { left: `calc(${100 - tipLeftPct}% + 14px)` }
              : { right: `calc(${tipLeftPct}% + 14px)` }),
          }}
        >
          <p className="mb-0.5 font-bold text-[color:var(--primary)]">
            {new Intl.DateTimeFormat("he-IL", {
              weekday: "long",
              day: "numeric",
              month: "numeric",
              timeZone: "Asia/Jerusalem",
            }).format(new Date(hp.t * 1000))}
          </p>
          {hp.contextRef && (
            <p className="mb-1 truncate text-[10px] text-[color:var(--primary)]/55">
              {hp.contextRef}
            </p>
          )}
          {TREND_SERIES.map((s) => (
            <p key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[color:var(--foreground)]/80">
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <b className="text-[color:var(--primary)]">{s.pick(hp)}</b>
            </p>
          ))}
          {hp.note && (
            <p className="mt-1 border-t border-[color:var(--border)] pt-1 text-[10px] text-[color:var(--foreground)]/65">
              💬 {hp.note.length > 70 ? hp.note.slice(0, 70) + "…" : hp.note}
            </p>
          )}
        </div>
      )}

      {/* legend — text in ink, identity via the dot */}
      {!mini && (
        <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px] text-[color:var(--foreground)]/75">
          {TREND_SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span
                className="inline-block h-2 w-4 rounded-full"
                style={{
                  background: s.color,
                  opacity: s.key === "difficulty" ? 0.75 : 1,
                }}
              />
              {s.label}
              {s.key === "difficulty" && (
                <span className="text-[9px] opacity-60">(נמוך = קל יותר)</span>
              )}
            </span>
          ))}
        </div>
      )}

      {points.length === 1 && !mini && (
        <p className="mt-1 text-center text-[11px] text-[color:var(--foreground)]/50">
          עוד רפלקציה אחת — ויצמח כאן קו 🌱
        </p>
      )}
    </div>
  );
}
