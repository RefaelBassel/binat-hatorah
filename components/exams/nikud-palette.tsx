"use client";

// Buttons that insert a nikud mark at the cursor of whichever text field in
// the editor was last focused. Pressing a button must not steal focus from the
// field (onMouseDown preventDefault), then the mark goes in with setRangeText
// and an `input` event so React's onChange sees the new value.
const MARKS: { ch: string; name: string }[] = [
  { ch: "ַ", name: "פתח" },
  { ch: "ָ", name: "קמץ" },
  { ch: "ֵ", name: "צירה" },
  { ch: "ֶ", name: "סגול" },
  { ch: "ִ", name: "חיריק" },
  { ch: "ֹ", name: "חולם" },
  { ch: "ֻ", name: "קובוץ" },
  { ch: "ּ", name: "דגש / שורוק" },
  { ch: "ְ", name: "שווא" },
  { ch: "ֲ", name: "חטף פתח" },
  { ch: "ֱ", name: "חטף סגול" },
  { ch: "ֳ", name: "חטף קמץ" },
  { ch: "ׁ", name: "שין ימנית" },
  { ch: "ׂ", name: "שין שמאלית" },
  { ch: "־", name: "מקף" },
];

export default function NikudPalette({ containerId }: { containerId: string }) {
  const insert = (ch: string) => {
    const root = document.getElementById(containerId);
    const el = document.activeElement;
    if (
      !root ||
      !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) ||
      !root.contains(el) ||
      el.type === "number" ||
      el.readOnly
    ) {
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.setRangeText(ch, start, end, "end");
    el.dispatchEvent(new Event("input", { bubbles: true }));
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="ניקוד">
      <span className="text-xs font-bold text-[color:var(--foreground)]/60">
        ניקוד — לוחצים בתוך שדה טקסט ואז על הסימן:
      </span>
      {MARKS.map((m) => (
        <button
          key={m.name}
          type="button"
          title={m.name}
          aria-label={m.name}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insert(m.ch)}
          className="h-8 min-w-8 rounded-md border border-[color:var(--border)] bg-[color:var(--field)] px-1.5 text-lg leading-none hover:border-[color:var(--accent)]"
        >
          {/* a dotted circle carries the mark so it is visible on its own */}
          <span dir="rtl">{`◌${m.ch}`}</span>
        </button>
      ))}
    </div>
  );
}
