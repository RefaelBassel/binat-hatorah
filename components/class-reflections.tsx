"use client";

// Teacher dashboard — the class reflection journey: a daily class-average
// trend chart, headline stats, and a per-student grid of mini trends.
// Live: refreshes every 45s and on window focus.

import { useEffect, useMemo, useState } from "react";
import ReflectionTrend, { type TrendPoint } from "./reflection-trend";

interface StudentSeries {
  id: number;
  name: string;
  points: TrendPoint[];
}

export default function ClassReflections() {
  const [students, setStudents] = useState<StudentSeries[] | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/reflections?scope=class", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setStudents(d.students);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 45000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      alive = false;
      clearInterval(iv);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  // class average per calendar day (Israel time): every reflection from
  // every student that day, averaged per measure
  const classDaily = useMemo(() => {
    if (!students) return [];
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const byDay = new Map<
      string,
      { t: number; d: number; p: number; a: number; n: number }
    >();
    for (const s of students) {
      for (const pt of s.points) {
        const day = fmt.format(new Date(pt.t * 1000));
        const acc = byDay.get(day) ?? { t: pt.t, d: 0, p: 0, a: 0, n: 0 };
        acc.t = Math.min(acc.t, pt.t);
        acc.d += pt.difficulty;
        acc.p += pt.pshat;
        acc.a += pt.argument;
        acc.n += 1;
        byDay.set(day, acc);
      }
    }
    return [...byDay.values()]
      .sort((x, y) => x.t - y.t)
      .map((v) => ({
        t: v.t,
        difficulty: Math.round((10 * v.d) / v.n) / 10,
        pshat: Math.round((10 * v.p) / v.n) / 10,
        argument: Math.round((10 * v.a) / v.n) / 10,
        contextRef: `${v.n} רפלקציות ביום זה`,
      }));
  }, [students]);

  if (!students) {
    return (
      <p className="text-sm text-[color:var(--foreground)]/60">
        טוען את מסע הרפלקציה של הכיתה...
      </p>
    );
  }

  const total = students.reduce((acc, s) => acc + s.points.length, 0);
  const withAny = students.filter((s) => s.points.length > 0);
  const weekAgo = Math.floor(Date.now() / 1000) - 7 * 86400;
  const lastWeek = students.reduce(
    (acc, s) => acc + s.points.filter((p) => p.t >= weekAgo).length,
    0
  );

  // chip selector: most recently active first; default = the most recent
  // sharer (falls back to the first student)
  const sorted = [...students].sort(
    (a, b) =>
      (b.points[b.points.length - 1]?.t ?? 0) -
      (a.points[a.points.length - 1]?.t ?? 0)
  );
  const selected =
    sorted.find((s) => s.id === selectedId) ??
    sorted.find((s) => s.points.length > 0) ??
    sorted[0] ??
    null;
  const selectedLast = selected?.points[selected.points.length - 1] ?? null;

  return (
    <div className="space-y-5">
      {/* headline stats */}
      <div className="flex flex-wrap gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-[color:var(--primary)]/10 px-3 py-1 text-[color:var(--primary)]">
          סה״כ רפלקציות: {total}
        </span>
        <span className="rounded-full bg-[color:var(--success)]/10 px-3 py-1 text-[color:var(--success)]">
          שיתפו עד כה: {withAny.length} מתוך {students.length}
        </span>
        <span className="rounded-full bg-[color:var(--accent)]/10 px-3 py-1 text-[color:var(--accent)]">
          בשבוע האחרון: {lastWeek}
        </span>
      </div>

      {/* class average trend */}
      <div className="rounded-2xl bg-[color:var(--background)] p-4">
        <p className="mb-2 text-[12px] font-bold text-[color:var(--primary)]/75">
          ממוצע כיתתי לפי ימים
        </p>
        <ReflectionTrend
          points={classDaily}
          emptyHint="כשהכיתה תתחיל לשתף רפלקציות — מסע הצמיחה המשותף יצמח כאן 🌱"
        />
      </div>

      {/* per-student trend — one chart, a chip selector to move between
          students (a chart per student would stretch the dashboard forever) */}
      {students.length > 0 && (
        <div>
          <p className="mb-2 text-[12px] font-bold text-[color:var(--primary)]/75">
            המסע של כל תלמיד/ה
          </p>
          <div className="mb-3 max-h-28 overflow-y-auto rounded-xl bg-[color:var(--background)] p-2">
            <div className="flex flex-wrap gap-1.5">
              {sorted.map((s) => {
                const active = s.id === selected?.id;
                const empty = s.points.length === 0;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    className={[
                      "rounded-full px-3 py-1 text-[11px] font-semibold transition",
                      active
                        ? "bg-[color:var(--primary)] text-white shadow"
                        : empty
                          ? "bg-[color:var(--card)] text-[color:var(--foreground)]/40 hover:text-[color:var(--foreground)]/70"
                          : "bg-[color:var(--card)] text-[color:var(--primary)] hover:bg-[color:var(--primary)]/10",
                    ].join(" ")}
                  >
                    {s.name}
                    {!empty && (
                      <span className={active ? "opacity-80" : "opacity-50"}>
                        {" "}
                        · {s.points.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selected && (
            <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-[color:var(--primary)]">
                  {selected.name}
                </p>
                {selectedLast ? (
                  <p className="text-[10px] text-[color:var(--primary)]/50">
                    {selected.points.length} רפלקציות · אחרונה:{" "}
                    {new Intl.DateTimeFormat("he-IL", {
                      day: "numeric",
                      month: "numeric",
                      timeZone: "Asia/Jerusalem",
                    }).format(new Date(selectedLast.t * 1000))}
                    {" · "}קושי {selectedLast.difficulty} · פשט {selectedLast.pshat}
                    {" · "}טיעון {selectedLast.argument}
                  </p>
                ) : (
                  <p className="text-[10px] text-[color:var(--primary)]/50">
                    טרם שיתפ/ה רפלקציה
                  </p>
                )}
              </div>
              <ReflectionTrend
                points={selected.points}
                emptyHint="עוד אין רפלקציות — כשישתפו, המסע יופיע כאן 🌱"
              />
              {selectedLast?.note && (
                <p className="mt-2 rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-[11px] text-[color:var(--foreground)]/75">
                  💬 מהרפלקציה האחרונה: {selectedLast.note}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
