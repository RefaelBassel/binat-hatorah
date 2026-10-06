"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TeacherChat from "./dashboard/teacher-chat";

// The floating chat button — teachers only, on every page (mounted from the
// root layout next to the lesson dock). Tap: a floating window with the same
// chat as /dashboard/chat; every conversation is saved on the server, so
// the window and the page always show the same history. The open state is
// remembered per browser. Hidden on projector screens.
export default function ChatFab({ teacherName }: { teacherName: string | null }) {
  const pathname = usePathname();
  const hidden =
    !pathname ||
    /\/(board|review)(\/|$)/.test(pathname) ||
    pathname.startsWith("/dashboard/class-board") ||
    pathname === "/dashboard/chat" ||
    pathname === "/login" ||
    pathname === "/onboarding" ||
    pathname === "/pending";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem("claude-chat-open") === "1");
    } catch {
      /* private mode */
    }
  }, []);
  const toggle = () => {
    setOpen((o) => {
      try {
        localStorage.setItem("claude-chat-open", o ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !o;
    });
  };
  if (hidden) return null;
  return (
    <>
      {open && (
        <div
          className="dock-in fixed bottom-20 left-3 z-[47] flex flex-col overflow-hidden rounded-3xl border-2 border-[color:var(--accent)]/60 shadow-2xl backdrop-blur sm:left-5"
          style={{ width: "min(440px, calc(100vw - 1.5rem))", height: "min(72vh, 680px)", background: "color-mix(in srgb, var(--card) 96%, transparent)" }}
          dir="rtl"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[color:var(--border)] px-4 py-2">
            <span className="font-display text-base font-extrabold text-[color:var(--primary)]">✨ הצ׳אט עם קלוד</span>
            <span className="flex items-center gap-2 text-xs font-bold text-[color:var(--primary)]/60">
              <a href="/dashboard/chat" className="hover:text-[color:var(--accent)]" title="לפתוח בעמוד מלא">
                ⤢ עמוד מלא
              </a>
              <button type="button" onClick={toggle} aria-label="לסגור את הצ׳אט" className="rounded-full px-2 py-0.5 hover:bg-[color:var(--background)]">
                ✕
              </button>
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
            <TeacherChat teacherName={teacherName} compact />
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "לסגור את הצ׳אט עם קלוד" : "לפתוח את הצ׳אט עם קלוד"}
        aria-expanded={open}
        className={`fixed bottom-4 left-3 z-[48] flex h-14 items-center gap-2 rounded-full px-4 text-sm font-extrabold text-white shadow-2xl transition hover:scale-[1.04] active:scale-95 sm:left-5 ${open ? "" : "fab-live"}`}
        style={{ background: "linear-gradient(135deg, var(--accent), var(--primary))" }}
      >
        <span className="text-xl" aria-hidden>
          {open ? "▾" : "✨"}
        </span>
        <span className="hidden sm:inline">{open ? "לקפל" : "לדבר עם קלוד"}</span>
      </button>
    </>
  );
}
