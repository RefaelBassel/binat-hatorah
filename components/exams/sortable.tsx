"use client";

import { useState } from "react";

// Drag-to-reorder without a library: the item becomes draggable only while the
// grip is pressed (so text fields inside keep normal selection), and a drop on
// another item of the SAME group moves it there. The ▲/▼ buttons do the same
// for touch screens and keyboards.
let dragging: { group: string; index: number } | null = null;

export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= arr.length || to >= arr.length) return arr;
  const next = arr.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export default function SortableItem({
  group,
  index,
  count,
  onMove,
  className = "",
  children,
}: {
  group: string;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  className?: string;
  children: (controls: React.ReactNode) => React.ReactNode;
}) {
  const [armed, setArmed] = useState(false);
  const [over, setOver] = useState(false);

  const btn =
    "flex h-6 w-6 items-center justify-center rounded border border-[color:var(--border)] bg-[color:var(--field)] text-[10px] leading-none hover:border-[color:var(--accent)] disabled:opacity-30";
  const controls = (
    <span className="inline-flex items-center gap-1" data-noexport>
      <span
        title="גרירה לשינוי סדר"
        aria-label="גרירה לשינוי סדר"
        onPointerDown={() => setArmed(true)}
        onPointerUp={() => setArmed(false)}
        className="flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded text-base text-[color:var(--foreground)]/50 hover:bg-[color:var(--border)]/50 active:cursor-grabbing"
      >
        ⠿
      </span>
      <button
        type="button"
        title="הזזה למעלה"
        aria-label="הזזה למעלה"
        disabled={index === 0}
        onClick={() => onMove(index, index - 1)}
        className={btn}
      >
        ▲
      </button>
      <button
        type="button"
        title="הזזה למטה"
        aria-label="הזזה למטה"
        disabled={index === count - 1}
        onClick={() => onMove(index, index + 1)}
        className={btn}
      >
        ▼
      </button>
    </span>
  );

  return (
    <div
      draggable={armed}
      onDragStart={(e) => {
        e.stopPropagation();
        dragging = { group, index };
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "exam-item");
      }}
      onDragEnd={() => {
        dragging = null;
        setArmed(false);
        setOver(false);
      }}
      onDragOver={(e) => {
        if (dragging?.group !== group) return;
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (dragging?.group !== group) return;
        e.preventDefault();
        e.stopPropagation();
        const from = dragging.index;
        dragging = null;
        setOver(false);
        setArmed(false);
        if (from !== index) onMove(from, index);
      }}
      className={`${className} ${over ? "outline-2 outline-dashed outline-[color:var(--accent)]" : ""}`}
    >
      {children(controls)}
    </div>
  );
}
