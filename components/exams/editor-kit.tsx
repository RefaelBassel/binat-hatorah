"use client";

import { useState, type ReactNode } from "react";

// Small building blocks for the exams editor: a nikud palette that types
// into the last focused field, auto-growing RTL text fields, and
// drag-to-reorder rows (with ↑/↓ buttons for touch screens).

let lastField: HTMLTextAreaElement | HTMLInputElement | null = null;

export function trackFocus(e: React.FocusEvent) {
  const t = e.target;
  if (t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && t.type === "text")) {
    lastField = t;
  }
}

function insertAtCursor(ch: string) {
  const el = lastField;
  if (!el || !document.body.contains(el)) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, el.value.slice(0, start) + ch + el.value.slice(end));
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  el.setSelectionRange(start + ch.length, start + ch.length);
}

const NIKUD: { ch: string; name: string; sample?: string }[] = [
  { ch: "ָ", name: "קמץ" },
  { ch: "ַ", name: "פתח" },
  { ch: "ֵ", name: "צירה" },
  { ch: "ֶ", name: "סגול" },
  { ch: "ְ", name: "שווא" },
  { ch: "ִ", name: "חיריק" },
  { ch: "ֹ", name: "חולם" },
  { ch: "ֻ", name: "קובוץ" },
  { ch: "ּ", name: "דגש / שורוק" },
  { ch: "ֲ", name: "חטף פתח" },
  { ch: "ֱ", name: "חטף סגול" },
  { ch: "ֳ", name: "חטף קמץ" },
  { ch: "ׁ", name: "שי״ן ימנית" },
  { ch: "ׂ", name: "שי״ן שמאלית" },
  { ch: "־", name: "מקף", sample: "־" },
  { ch: "״", name: "גרשיים", sample: "״" },
  { ch: "׳", name: "גרש", sample: "׳" },
  { ch: "–", name: "קו מפריד", sample: "–" },
];

export function NikudBar() {
  return (
    <div className="flex flex-wrap items-center gap-1" aria-label="ניקוד">
      <span className="me-1 text-xs font-semibold text-[color:var(--foreground)]/60">ניקוד:</span>
      {NIKUD.map((n) => (
        <button
          key={n.name}
          type="button"
          title={n.name}
          aria-label={n.name}
          // keep the focus (and the cursor) in the text field
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => insertAtCursor(n.ch)}
          className="h-8 min-w-8 rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-1 text-lg leading-none transition hover:bg-[color:var(--primary)]/10 active:scale-95"
        >
          {n.sample ?? `ב${n.ch}`}
        </button>
      ))}
    </div>
  );
}

export function TextField({
  value,
  onChange,
  placeholder,
  minRows = 1,
  className = "",
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  label: string;
}) {
  const rows = Math.max(
    minRows,
    value.split("\n").reduce((s, line) => s + 1 + Math.floor(line.length / 90), 0)
  );
  return (
    <textarea
      dir="rtl"
      lang="he"
      aria-label={label}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full resize-none rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 leading-7 outline-none focus:border-[color:var(--primary)] ${className}`}
    />
  );
}

export function NumField({
  value,
  onChange,
  label,
  placeholder = "",
  width = "w-20",
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  label: string;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--foreground)]/70">
      {label}
      <input
        type="number"
        min={0}
        step="any"
        inputMode="decimal"
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.trim();
          const n = Number(raw);
          onChange(raw === "" || !Number.isFinite(n) ? null : n);
        }}
        className={`${width} rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-sm`}
      />
    </label>
  );
}

export function move<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}

let dragging: { list: string; index: number } | null = null;

// One draggable row. Dragging starts only from the handle, so text inside
// the row stays selectable. Rows only accept drops from their own list.
export function SortRow({
  list,
  index,
  count,
  onMove,
  onRemove,
  removeLabel,
  className = "",
  children,
}: {
  list: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
  children: (tools: ReactNode) => ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [over, setOver] = useState(false);
  const btn =
    "grid h-7 w-7 place-items-center rounded-md text-sm text-[color:var(--foreground)]/60 transition hover:bg-[color:var(--primary)]/10 disabled:opacity-30";
  const tools = (
    <span className="inline-flex items-center gap-0.5">
      <span
        role="button"
        tabIndex={-1}
        title="גררו לשינוי הסדר"
        aria-label="גרירה לשינוי הסדר"
        onPointerDown={() => setArmed(true)}
        onPointerUp={() => setArmed(false)}
        className={`${btn} cursor-grab select-none active:cursor-grabbing`}
      >
        ⠿
      </span>
      <button type="button" className={btn} title="למעלה" aria-label="הזזה למעלה" disabled={index === 0} onClick={() => onMove(index, index - 1)}>
        ↑
      </button>
      <button type="button" className={btn} title="למטה" aria-label="הזזה למטה" disabled={index === count - 1} onClick={() => onMove(index, index + 1)}>
        ↓
      </button>
      {onRemove && (
        <button
          type="button"
          className={`${btn} hover:!bg-[color:var(--danger)]/10 hover:text-[color:var(--danger)]`}
          title={removeLabel ?? "מחיקה"}
          aria-label={removeLabel ?? "מחיקה"}
          onClick={() => {
            if (window.confirm(`${removeLabel ?? "למחוק"}?`)) onRemove();
          }}
        >
          ✕
        </button>
      )}
    </span>
  );
  return (
    <div
      draggable={armed}
      onDragStart={(e) => {
        e.stopPropagation();
        dragging = { list, index };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "");
      }}
      onDragEnd={() => {
        setArmed(false);
        setOver(false);
        dragging = null;
      }}
      onDragOver={(e) => {
        if (dragging?.list !== list) return;
        e.preventDefault();
        e.stopPropagation();
        if (!over) setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        if (dragging?.list !== list) return;
        e.preventDefault();
        e.stopPropagation();
        onMove(dragging.index, index);
        dragging = null;
        setArmed(false);
      }}
      className={`${className} ${over ? "ring-2 ring-[color:var(--accent)]" : ""} ${armed ? "opacity-70" : ""}`}
    >
      {children(tools)}
    </div>
  );
}

export function AddButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-dashed border-[color:var(--primary)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10 active:scale-95"
    >
      + {children}
    </button>
  );
}
