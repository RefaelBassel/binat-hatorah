// Server-rendered SVG trend graph of a student's reflections over time.
// Three lines: difficulty (inverted feel — lower is easier), pshat progress,
// argument progress. Hoping the trend climbs 🌱

export interface ReflectionPoint {
  createdAt: number;
  difficulty: number;
  pshat: number;
  argument: number;
}

const W = 560;
const H = 180;
const PAD = 28;

function path(points: ReflectionPoint[], pick: (p: ReflectionPoint) => number): string {
  if (points.length === 0) return "";
  const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = W - PAD - i * xStep; // RTL: first point on the right
      const y = H - PAD - ((pick(p) - 1) / 9) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function ReflectionGraph({ points }: { points: ReflectionPoint[] }) {
  if (points.length === 0) return null;
  const series = [
    { key: "pshat", color: "#3e6b4f", label: "📖 פענוח הפשט", pick: (p: ReflectionPoint) => p.pshat },
    { key: "argument", color: "#413055", label: "⚖️ מיומנות הטיעון", pick: (p: ReflectionPoint) => p.argument },
    { key: "difficulty", color: "#b96a3b", label: "🌡️ רמת הקושי", pick: (p: ReflectionPoint) => p.difficulty },
  ];
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl bg-[color:var(--background)]"
        role="img"
        aria-label="גרף מגמת הרפלקציות שלי"
      >
        {[1, 5, 10].map((v) => {
          const y = H - PAD - ((v - 1) / 9) * (H - PAD * 2);
          return (
            <g key={v}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#e9ddd2" strokeWidth="1" />
              <text x={W - PAD + 4} y={y + 3} fontSize="9" fill="#94897e">
                {v}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <path
            key={s.key}
            d={path(points, s.pick)}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.key === "difficulty" ? 0.55 : 0.9}
          />
        ))}
        {points.map((p, i) => {
          const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
          const x = W - PAD - i * xStep;
          return series.map((s) => {
            const y = H - PAD - ((s.pick(p) - 1) / 9) * (H - PAD * 2);
            return <circle key={`${i}-${s.key}`} cx={x} cy={y} r="3" fill={s.color} />;
          });
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px]">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
