"use client";

// The projectable class board — full-screen, beautiful, meant for the
// classroom projector: task name + Tanach chapter, a live clock, the whole
// class as cards with per-question dots, and a big class-average bar.
// Polls every 4 seconds; the clock ticks every second.

import { useEffect, useState } from "react";

interface StudentRow {
  id: number;
  name: string;
  stage: number;
  unitsDone: number;
  doneKeys: string[];
  workSeconds: number;
  lastBeat: number | null;
  status: "active" | "idle" | "submitted" | "absent";
}

interface ClassStatus {
  task: { id: number; title: string; subtitle: string; bookRef: string; dueAt: number };
  totalUnits: number;
  units: { key: string; label: string; part: "a" | "b" }[];
  students: StudentRow[];
}

export default function ClassBoard({ taskId }: { taskId: number }) {
  const [data, setData] = useState<ClassStatus | null>(null);
  const [clock, setClock] = useState("");
  const [dateLine, setDateLine] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/tasks/${taskId}/class-status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setData(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [taskId]);

  // the board is chrome-free for the projector, so it needs its own way
  // out — a discreet corner button plus the Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.location.href = "/dashboard";
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        new Intl.DateTimeFormat("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        }).format(d)
      );
      setDateLine(
        new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(d) +
          " · " +
          new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
            day: "numeric",
            month: "long",
            timeZone: "Asia/Jerusalem",
          }).format(d)
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-[color:var(--primary)]/60">
        טוען את לוח הכיתה...
      </div>
    );
  }

  const present = data.students.filter((s) => s.status === "active" || s.status === "submitted");
  const away = data.students.filter((s) => s.status === "idle" || s.status === "absent");
  const classPct =
    data.students.length === 0
      ? 0
      : Math.round(
          (100 * data.students.reduce((acc, s) => acc + s.unitsDone, 0)) /
            (data.totalUnits * data.students.length)
        );
  const submittedCount = data.students.filter((s) => s.status === "submitted").length;

  return (
    <div className="min-h-screen px-8 py-6" style={{ background: "var(--background)" }}>
      {/* discreet exit — barely visible on the projector, obvious on hover */}
      <a
        href="/dashboard"
        title="יציאה מהלוח (או מקש Esc)"
        aria-label="יציאה מהלוח"
        className="fixed top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--card)] text-sm font-bold text-[color:var(--primary)]/70 opacity-40 shadow-sm transition hover:opacity-100"
        style={{ insetInlineEnd: 12 }}
      >
        ✕
      </a>
      {/* header */}
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 flex items-center gap-3" aria-hidden>
            <div className="h-px w-14 bg-[color:var(--accent)]/60" />
            <div className="h-2 w-2 rotate-45 bg-[color:var(--accent)]" />
            <div className="h-px w-14 bg-[color:var(--accent)]/60" />
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-[color:var(--primary)]">
            {data.task.title}
          </h1>
          <p className="mt-1 text-lg text-[color:var(--accent)]">
            📖 {data.task.bookRef} · {data.task.subtitle}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-6 py-4 text-center shadow-sm">
          <p className="font-display text-4xl font-extrabold tabular-nums text-[color:var(--primary)]">
            {clock}
          </p>
          <p className="mt-1 text-sm text-[color:var(--primary)]/60">{dateLine}</p>
        </div>
      </header>

      {/* class aggregate */}
      <div className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-xl font-bold text-[color:var(--primary)]">
            📊 הכיתה יחד
          </p>
          <p className="text-sm font-bold text-[color:var(--primary)]/70">
            🟢 {present.length - submittedCount} עובדים · ✅ {submittedCount} הגישו · ⚪ {away.length} לא נוכחים
          </p>
        </div>
        <div className="h-5 overflow-hidden rounded-full bg-[color:var(--border)]">
          <div
            className="flex h-full items-center justify-end rounded-full pe-2 text-[11px] font-bold text-white transition-all duration-1000"
            style={{
              width: `${Math.max(classPct, 4)}%`,
              background: "linear-gradient(270deg, var(--primary), var(--accent))",
            }}
          >
            {classPct}%
          </div>
        </div>
      </div>

      {/* student cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {[...data.students]
          .sort((a, b) => {
            const rank = (s: StudentRow) =>
              s.status === "submitted" ? 0 : s.status === "active" ? 1 : 2;
            return rank(a) - rank(b) || b.unitsDone - a.unitsDone;
          })
          .map((s) => {
            const pct = Math.round((100 * s.unitsDone) / Math.max(1, data.totalUnits));
            const dim = s.status === "idle" || s.status === "absent";
            const doneSet = new Set(s.doneKeys);
            return (
              <div
                key={s.id}
                className="rounded-2xl border bg-[color:var(--card)] p-4 shadow-sm transition"
                style={{
                  borderColor:
                    s.status === "submitted"
                      ? "var(--success)"
                      : s.status === "active"
                        ? "var(--border)"
                        : "var(--border)",
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="truncate font-display text-lg font-bold text-[color:var(--primary)]">
                    {s.status === "active" && (
                      <span className="relative me-1.5 inline-flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--success)]" />
                      </span>
                    )}
                    {s.name}
                  </p>
                  <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-[color:var(--primary)]">
                    {s.status === "submitted" ? "🎉" : `${pct}%`}
                  </span>
                </div>

                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[color:var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: s.status === "submitted" ? "var(--success)" : "var(--primary)",
                    }}
                  />
                </div>

                {/* the equal-weight units, dot per question */}
                <div className="flex flex-wrap gap-1">
                  {data.units.map((u, ui) => {
                    const stageNum = u.key.startsWith("stage:")
                      ? Number(u.key.split(":")[1])
                      : null;
                    const filled =
                      stageNum != null
                        ? Math.min(Math.max(s.stage - 1, 0), 7) >= stageNum
                        : doneSet.has(u.key);
                    return (
                      <span
                        key={ui}
                        title={u.label}
                        className="inline-block rounded-full"
                        style={{
                          width: 9,
                          height: 9,
                          background: filled
                            ? u.part === "a"
                              ? "var(--accent)"
                              : "var(--primary)"
                            : "var(--border)",
                        }}
                      />
                    );
                  })}
                </div>

                <p className="mt-2 text-[11px] text-[color:var(--primary)]/55">
                  {s.status === "submitted"
                    ? "הגיש/ה את המשימה ✓"
                    : s.status === "absent" && s.stage === 0
                      ? "טרם פתח/ה את המשימה"
                      : dim
                        ? "לא נוכח/ת כרגע"
                        : s.stage >= 8
                          ? "חלק ב — העמקה ודיון"
                          : `חלק א · שלב ${s.stage || 1} מתוך 7`}
                </p>
              </div>
            );
          })}
      </div>

      <footer className="mt-6 flex items-center justify-between text-xs text-[color:var(--primary)]/45">
        <span>🟠 שלבי חלק א · 🟣 שאלות חלק ב · כל שאלה שווה בערכה</span>
        <span>מתעדכן אוטומטית כל כמה שניות</span>
      </footer>
    </div>
  );
}
