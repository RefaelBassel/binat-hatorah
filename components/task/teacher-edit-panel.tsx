"use client";

import { useState } from "react";
import type { CheckOpenQuestion, CheckQuestion, OpeningDeck, PlenaryQuestion, TaskSection } from "@/content/tasks/types";
import type { UnitEdits, WorksheetEdits } from "@/lib/content-overrides";
import WorksheetEditor, { type UnitMeta } from "./worksheet-editor";
import CheckEditor from "./check-editor";
import { PlenaryEditor } from "./thinking-card";
import { OpeningEditor } from "@/components/opening-deck";

// The teacher's edit bar — rendered ONLY for a teacher outside student mode
// (decided on the server; students never receive this component). It sits
// at the top of the task itself, so everything is edited where it is seen:
// one tap opens the editor of that part, right there, and closes back.
type Tab = "texts" | "check" | "plenary" | "opening";

const TABS: { id: Tab; emoji: string; label: string; hint: string }[] = [
  { id: "opening", emoji: "✨", label: "אור פותח", hint: "מצגת הפתיחה של השיעור" },
  { id: "texts", emoji: "📝", label: "טקסטים ושאלות", hint: "כותרות, הסברים, מקורות וכל שאלות חלק ב" },
  { id: "check", emoji: "✅", label: "בדיקת ההבנה", hint: "השאלות הסגורות של שלב 7" },
  { id: "plenary", emoji: "💭", label: "שאלת המליאה", hint: "״שאלה למחשבה״ שאחרי חלק ב" },
];

export default function TeacherEditPanel({
  contentRef,
  taskId,
  originalSections,
  unitMeta,
  edits,
  unitEdits,
  check,
  checkOpen,
  plenary,
  opening,
  edited,
}: {
  contentRef: string;
  taskId: number | null;
  originalSections: TaskSection[];
  unitMeta: UnitMeta;
  edits: WorksheetEdits;
  unitEdits: UnitEdits;
  check: CheckQuestion[];
  checkOpen: CheckOpenQuestion | null;
  plenary: PlenaryQuestion | null;
  opening: OpeningDeck | null;
  edited: Partial<Record<Tab, boolean>>;
}) {
  const [tab, setTab] = useState<Tab | null>(null);
  return (
    <div className="no-print mb-6 rounded-2xl border-2 border-dashed border-[color:var(--primary)]/35 bg-[color:var(--card)] p-3" dir="rtl">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-extrabold text-[color:var(--primary)]">✏️ עריכת המשימה</span>
        <span className="text-[10px] text-[color:var(--primary)]/50">רק את רואה את זה · התלמידות רואות את מה שתשמרי</span>
        <span className="ms-auto flex flex-wrap items-center gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab((cur) => (cur === t.id ? null : t.id))}
              title={t.hint}
              aria-pressed={tab === t.id}
              className={`rounded-full border-2 px-3 py-1 text-xs font-bold transition active:scale-95 ${
                tab === t.id
                  ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white shadow"
                  : "border-[color:var(--border)] text-[color:var(--primary)] hover:border-[color:var(--accent)]"
              }`}
            >
              {t.emoji} {t.label}
              {edited[t.id] && tab !== t.id && <span className="ms-1 text-[9px] text-[color:var(--accent)]">● נערך</span>}
            </button>
          ))}
          {taskId != null && (
            <a
              href={`/dashboard/opening/${taskId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-[color:var(--accent)] px-3 py-1 text-xs font-bold text-white shadow transition hover:scale-[1.03]"
            >
              🖥️ להציג את אור פותח ↗
            </a>
          )}
        </span>
      </div>

      {tab && (
        <div className="mt-3">
          {tab === "texts" && (
            <WorksheetEditor contentRef={contentRef} sections={originalSections} edits={edits} unitEdits={unitEdits} unitMeta={unitMeta} onClose={() => setTab(null)} />
          )}
          {tab === "check" && <CheckEditor contentRef={contentRef} initialCheck={check} initialOpen={checkOpen} onClose={() => setTab(null)} />}
          {tab === "plenary" && (
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--background)] p-4">
              <p className="mb-1 font-display text-base font-extrabold text-[color:var(--primary)]">💭 שאלת המליאה</p>
              <p className="mb-2 text-xs text-[color:var(--foreground)]/60">
                לתלמידות היא מופיעה ככרטיס ״שאלה למחשבה״ אחרי חלק ב; לך — במסך הסגירה ובשקף האחרון של אור פותח.
              </p>
              <PlenaryEditor contentRef={contentRef} initial={plenary} onClose={() => setTab(null)} />
            </div>
          )}
          {tab === "opening" && (
            <div className="space-y-3">
              <OpeningEditor contentRef={contentRef} initial={opening} onClose={() => setTab(null)} />
              <p className="text-center text-[11px] text-[color:var(--primary)]/55">
                השקף הראשון לוקח את כותרת המשימה (לשונית ״טקסטים ושאלות״), והאחרון את שאלת המליאה.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
