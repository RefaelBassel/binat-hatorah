"use client";

import { useLayoutEffect, useRef } from "react";

// Hebrew, right-to-left textarea that grows with its content. Nikud is just
// text — typed, pasted, or inserted with the nikud palette.
export default function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 1,
  className = "",
  readOnly = false,
  ariaLabel,
}: {
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      dir="rtl"
      lang="he"
      rows={minRows}
      value={value}
      readOnly={readOnly}
      aria-label={ariaLabel}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full resize-none overflow-hidden rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2 text-base leading-8 outline-none focus:border-[color:var(--accent)] ${className}`}
    />
  );
}
