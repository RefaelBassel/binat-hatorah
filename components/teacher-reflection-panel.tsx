"use client";

import { useEffect, useState } from "react";

// What the TEACHER sees inside the reflection drawer: not a form for
// herself, but the class's entries — who reflected on the current context
// (this task / this page), their three sliders and their words, and the
// class averages. The full trend charts stay on the dashboard.
interface Point {
  t: number;
  difficulty: number;
  pshat: number;
  argument: number;
  note: string | null;
  contextRef: string | null;
  taskId: number | null;
}
interface StudentSeries {
  id: number;
  name: string;
  points: Point[];
}

function fmt(ts: number) {
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  }).format(new Date(ts * 1000));
}

export default function TeacherReflectionPanel({
  taskId,
  contextRef,
  active,
}: {
  taskId?: number;
  contextRef: string;
  active: boolean;
}) {
  const [students, setStudents] = useState<StudentSeries[] | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const load = () =>
      fetch("/api/reflections?scope=class", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setStudents(d.students);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [active]);

  if (!students) {
    return <p className="p-5 text-xs text-[color:var(--foreground)]/60">טוען את רפלקציות הכיתה...</p>;
  }

  // the entries that belong to what the teacher is looking at right now
  const inContext = (p: Point) =>
    taskId != null ? p.taskId === taskId : p.contextRef === contextRef;
  const here = students
    .map((s) => {
      const pts = s.points.filter(inContext);
      return pts.length ? { id: s.id, name: s.name, last: pts[pts.length - 1], n: pts.length } : null;
    })
    .filter((x): x is { id: number; name: string; last: Point; n: number } => x != null)
    .sort((a, b) => b.last.t - a.last.t);
  const avg = (k: "difficulty" | "pshat" | "argument") =>
    here.length === 0
      ? null
      : Math.round((10 * here.reduce((s, h) => s + h.last[k], 0)) / here.length) / 10;

  // fallback: the freshest entries from anywhere
  const latest = students
    .flatMap((s) => s.points.map((p) => ({ name: s.name, p })))
    .sort((a, b) => b.p.t - a.p.t)
    .slice(0, 6);

  return (
    <div className="space-y-4 p-4">
      <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] p-3">
        <p className="text-[11px] font-bold text-[color:var(--primary)]/70">
          {taskId != null ? "על המשימה הזו" : `על ״${contextRef}״`} · {here.length} שיקפו
        </p>
        {here.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
            <Avg label="קושי 🥵" value={avg("difficulty")} invert />
            <Avg label="פשט 📖" value={avg("pshat")} />
            <Avg label="טיעון ⚖️" value={avg("argument")} />
          </div>
        )}
      </div>

      {here.length > 0 ? (
        <ul className="space-y-1.5">
          {here.map((h) => (
            <li key={h.id} className="rounded-xl bg-[color:var(--background)] px-3 py-2">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-semibold">{h.name}</span>
                <span className="flex items-center gap-1.5 text-[10px] font-bold tabular-nums">
                  <Chip label="קושי" v={h.last.difficulty} invert />
                  <Chip label="פשט" v={h.last.pshat} />
                  <Chip label="טיעון" v={h.last.argument} />
                </span>
              </div>
              {h.last.note && (
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--foreground)]/80">
                  💬 {h.last.note}
                </p>
              )}
              <p className="mt-0.5 text-[10px] text-[color:var(--primary)]/45">
                {fmt(h.last.t)}
                {h.n > 1 && ` · ${h.n} רפלקציות כאן`}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="mb-2 text-xs text-[color:var(--foreground)]/60">
            עוד אף אחד לא שיקף כאן. האחרונות בכיתה:
          </p>
          {latest.length === 0 ? (
            <p className="text-[11px] text-[color:var(--primary)]/45">אין עדיין רפלקציות בכיתה.</p>
          ) : (
            <ul className="space-y-1">
              {latest.map((l, i) => (
                <li key={i} className="rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-[11px]">
                  <span className="font-semibold">{l.name}</span>
                  <span className="text-[color:var(--primary)]/55"> · {l.p.contextRef ?? "—"} · {fmt(l.p.t)}</span>
                  {l.p.note && <p className="mt-0.5 text-[color:var(--foreground)]/75">💬 {l.p.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <a
        href="/dashboard"
        className="block rounded-full border border-[color:var(--border)] py-2 text-center text-[11px] font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
      >
        הגרפים המלאים — ממוצע כיתתי ולכל תלמיד/ה — בדשבורד ←
      </a>
    </div>
  );
}

function Avg({ label, value, invert }: { label: string; value: number | null; invert?: boolean }) {
  const good = value == null ? null : invert ? value <= 4 : value >= 7;
  return (
    <div className="rounded-lg bg-[color:var(--card)] py-1.5">
      <p className="text-[10px] text-[color:var(--primary)]/55">{label}</p>
      <p
        className="font-display text-lg font-extrabold tabular-nums"
        style={{ color: good == null ? "var(--primary)" : good ? "var(--success)" : "var(--warning)" }}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function Chip({ label, v, invert }: { label: string; v: number; invert?: boolean }) {
  const good = invert ? v <= 4 : v >= 7;
  return (
    <span
      className="rounded-full px-1.5 py-0.5"
      style={{
        background: good ? "color-mix(in srgb, var(--success) 14%, transparent)" : "color-mix(in srgb, var(--warning) 16%, transparent)",
        color: good ? "var(--success)" : "var(--warning)",
      }}
      title={label}
    >
      {label} {v}
    </span>
  );
}
