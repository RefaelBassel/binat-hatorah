"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { COMPLETION_META, COMPLETION_STATUSES, type CompletionStatus } from "@/lib/completion-meta";
import type { GradesReport, ReportCell } from "@/lib/grades-report";

type Counts = Record<CompletionStatus, number> & { pending: number; missing: number };
const emptyCounts = (): Counts => ({ done: 0, partial: 0, not_done: 0, pending: 0, missing: 0 });

function addTo(c: Counts, cell: ReportCell | undefined) {
  if (!cell) return;
  if (cell.kind === "approved" && cell.status) c[cell.status] += 1;
  else if (cell.kind === "pending") c.pending += 1;
  else if (cell.kind === "missing") c.missing += 1;
}

function cellText(cell: ReportCell | undefined): string {
  if (!cell) return "";
  switch (cell.kind) {
    case "approved":
      return cell.status ? COMPLETION_META[cell.status].label : "";
    case "pending":
      return cell.status
        ? `ממתין לאישור (מוצע: ${COMPLETION_META[cell.status].label})`
        : "ממתין לאישור";
    case "missing":
      return "לא הוגשה";
    case "open":
      return "טרם הוגשה";
    default:
      return "";
  }
}

const csvField = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

const countsText = (c: Counts) =>
  [
    `${COMPLETION_META.done.label}: ${c.done}`,
    `${COMPLETION_META.partial.label}: ${c.partial}`,
    `${COMPLETION_META.not_done.label}: ${c.not_done}`,
    c.pending ? `ממתין לאישור: ${c.pending}` : "",
    c.missing ? `לא הוגשו: ${c.missing}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

export default function GradesReportTable({ report }: { report: GradesReport }) {
  const [taskFilter, setTaskFilter] = useState("all");
  const [studentFilter, setStudentFilter] = useState("all");
  const [downloaded, setDownloaded] = useState<"idle" | "done" | "error">("idle");

  const tasks = useMemo(
    () => (taskFilter === "all" ? report.tasks : report.tasks.filter((t) => String(t.id) === taskFilter)),
    [report.tasks, taskFilter]
  );
  const students = useMemo(
    () =>
      studentFilter === "all"
        ? report.students
        : report.students.filter((s) => String(s.id) === studentFilter),
    [report.students, studentFilter]
  );
  const cell = (taskId: number, userId: number) => report.cells[`${taskId}:${userId}`];

  const rowCounts = (userId: number) => {
    const c = emptyCounts();
    for (const t of tasks) addTo(c, cell(t.id, userId));
    return c;
  };
  const colCounts = (taskId: number) => {
    const c = emptyCounts();
    for (const s of students) addTo(c, cell(taskId, s.id));
    return c;
  };

  const download = () => {
    try {
      const header = [
        "תלמיד/ה",
        ...tasks.map((t) => (t.tag ? `${t.title} (${t.tag})` : t.title)),
        COMPLETION_META.done.label,
        COMPLETION_META.partial.label,
        COMPLETION_META.not_done.label,
        "ממתין לאישור",
        "לא הוגשו",
      ];
      const lines = [header.map(csvField).join(",")];
      for (const s of students) {
        const c = rowCounts(s.id);
        lines.push(
          [s.name, ...tasks.map((t) => cellText(cell(t.id, s.id))), c.done, c.partial, c.not_done, c.pending, c.missing]
            .map(csvField)
            .join(",")
        );
      }
      lines.push(["סיכום כיתתי", ...tasks.map((t) => countsText(colCounts(t.id)))].map(csvField).join(","));
      // UTF-8 with BOM so Excel opens the Hebrew correctly
      const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `דוח-ציונים-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setDownloaded("done");
    } catch {
      setDownloaded("error");
    }
    window.setTimeout(() => setDownloaded("idle"), 4000);
  };

  const selectClass =
    "rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1.5 text-sm";

  return (
    <div>
      {/* filters + export */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">משימה</span>
            <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value)} className={selectClass}>
              <option value="all">כל המשימות ({report.tasks.length})</option>
              {report.tasks.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.tag ? `${t.title} (${t.tag})` : t.title}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-[color:var(--primary)]/70">תלמיד/ה</span>
            <select
              value={studentFilter}
              onChange={(e) => setStudentFilter(e.target.value)}
              className={selectClass}
            >
              <option value="all">כל הכיתה ({report.students.length})</option>
              {report.students.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {(taskFilter !== "all" || studentFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                setTaskFilter("all");
                setStudentFilter("all");
              }}
              className="pb-1.5 text-xs font-semibold text-[color:var(--accent)] underline"
            >
              ניקוי הסינון
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {downloaded === "done" && (
            <span className="text-xs font-semibold text-[color:var(--success)]">✅ הקובץ ירד</span>
          )}
          {downloaded === "error" && (
            <span className="text-xs font-semibold text-[color:var(--danger)]">ההורדה נכשלה — נסו שוב</span>
          )}
          <button
            type="button"
            onClick={download}
            className="rounded-full bg-[color:var(--success-fill)] px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
          >
            ⬇️ הורדה לאקסל
          </button>
        </div>
      </div>

      {/* legend */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
        {COMPLETION_STATUSES.map((s) => (
          <span
            key={s}
            className="rounded-full px-2.5 py-0.5 font-bold"
            style={{ background: COMPLETION_META[s].bg, color: COMPLETION_META[s].color }}
          >
            {COMPLETION_META[s].label}
          </span>
        ))}
        <span className="rounded-full border border-dashed border-[color:var(--warning)] px-2.5 py-0.5 font-bold text-[color:var(--warning)]">
          ממתין לאישור
        </span>
        <span className="text-[color:var(--foreground)]/55">
          · הסטטוס המוצע מופיע באפור עד האישור · התלמידים רואים רק סטטוס שאושר
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]">
        <table className="w-full border-collapse text-right text-sm">
          <thead>
            <tr className="bg-[color:var(--primary)]/5 text-xs text-[color:var(--primary)]">
              <th className="sticky start-0 z-10 bg-[color:var(--card)] px-3 py-2.5 font-semibold">תלמיד/ה</th>
              {tasks.map((t) => (
                <th key={t.id} className="min-w-[8.5rem] px-2 py-2.5 align-bottom font-semibold">
                  <Link href={`/dashboard/task/${t.id}`} className="hover:underline">
                    {t.title}
                  </Link>
                  {t.tag && (
                    <span className="ms-1.5 rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent)]">
                      {t.tag}
                    </span>
                  )}
                </th>
              ))}
              <th className="px-2 py-2.5 font-semibold" style={{ color: COMPLETION_META.done.color }}>
                {COMPLETION_META.done.label}
              </th>
              <th className="px-2 py-2.5 font-semibold" style={{ color: COMPLETION_META.partial.color }}>
                {COMPLETION_META.partial.label}
              </th>
              <th className="px-2 py-2.5 font-semibold" style={{ color: COMPLETION_META.not_done.color }}>
                {COMPLETION_META.not_done.label}
              </th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const c = rowCounts(s.id);
              return (
                <tr key={s.id} className="border-t border-[color:var(--border)]">
                  <th
                    scope="row"
                    className="sticky start-0 z-10 whitespace-nowrap bg-[color:var(--card)] px-3 py-2 font-semibold text-[color:var(--primary)]"
                  >
                    {s.name}
                  </th>
                  {tasks.map((t) => (
                    <td key={t.id} className="px-2 py-1.5">
                      <Cell cell={cell(t.id, s.id)} href={`/dashboard/submission/${t.id}/${s.id}`} />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-bold tabular-nums" style={{ color: COMPLETION_META.done.color }}>
                    {c.done}
                  </td>
                  <td className="px-2 py-2 text-center font-bold tabular-nums" style={{ color: COMPLETION_META.partial.color }}>
                    {c.partial}
                  </td>
                  <td className="px-2 py-2 text-center font-bold tabular-nums" style={{ color: COMPLETION_META.not_done.color }}>
                    {c.not_done}
                    {(c.pending > 0 || c.missing > 0) && (
                      <span className="block text-[10px] font-normal text-[color:var(--foreground)]/50">
                        {c.pending > 0 && `${c.pending} ממתינות`}
                        {c.pending > 0 && c.missing > 0 && " · "}
                        {c.missing > 0 && `${c.missing} לא הוגשו`}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[color:var(--border)] bg-[color:var(--primary)]/5 align-top text-[11px]">
              <th
                scope="row"
                className="sticky start-0 z-10 bg-[color:var(--card)] px-3 py-2 text-xs font-bold text-[color:var(--primary)]"
              >
                סיכום כיתתי
              </th>
              {tasks.map((t) => {
                const c = colCounts(t.id);
                return (
                  <td key={t.id} className="px-2 py-2 leading-5">
                    <span className="block font-bold" style={{ color: COMPLETION_META.done.color }}>
                      {COMPLETION_META.done.label}: {c.done}
                    </span>
                    <span className="block font-bold" style={{ color: COMPLETION_META.partial.color }}>
                      {COMPLETION_META.partial.label}: {c.partial}
                    </span>
                    <span className="block font-bold" style={{ color: COMPLETION_META.not_done.color }}>
                      {COMPLETION_META.not_done.label}: {c.not_done}
                    </span>
                    {c.pending > 0 && (
                      <span className="block text-[color:var(--warning)]">ממתין לאישור: {c.pending}</span>
                    )}
                    {c.missing > 0 && (
                      <span className="block text-[color:var(--foreground)]/55">לא הוגשו: {c.missing}</span>
                    )}
                  </td>
                );
              })}
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Cell({ cell, href }: { cell: ReportCell | undefined; href: string }) {
  if (!cell || cell.kind === "none") {
    return <span className="block text-center text-[color:var(--foreground)]/30">—</span>;
  }
  const base = "block rounded-lg px-2 py-1 text-center text-xs font-bold transition hover:ring-2 hover:ring-[color:var(--accent)]/50";
  if (cell.kind === "approved" && cell.status) {
    const meta = COMPLETION_META[cell.status];
    return (
      <Link href={href} className={base} style={{ background: meta.bg, color: meta.color }}>
        {meta.label}
      </Link>
    );
  }
  if (cell.kind === "pending") {
    return (
      <Link
        href={href}
        className={`${base} border border-dashed border-[color:var(--warning)] text-[color:var(--warning)]`}
      >
        ממתין לאישור
        {cell.status && (
          <span className="block text-[10px] font-semibold text-[color:var(--foreground)]/45">
            {COMPLETION_META[cell.status].label}
          </span>
        )}
      </Link>
    );
  }
  return (
    <Link href={href} className={`${base} font-semibold text-[color:var(--foreground)]/45`}>
      {cell.kind === "missing" ? "לא הוגשה" : "טרם הוגשה"}
    </Link>
  );
}
