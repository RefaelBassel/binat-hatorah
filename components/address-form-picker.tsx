"use client";

import { useState } from "react";

// Small preference control on the personal page: how the site and Claude
// address this user. Stored in the DB and injected into every Claude prompt.
const OPTIONS = [
  { value: "f", label: "לשון נקבה", example: "נסי, קראי" },
  { value: "m", label: "לשון זכר", example: "נסה, קרא" },
  { value: "neutral", label: "ניטרלי", example: "נסו, קראו" },
];

export default function AddressFormPicker({ initial }: { initial: string | null }) {
  const [value, setValue] = useState(initial ?? "neutral");
  const [saved, setSaved] = useState(false);

  const pick = async (v: string) => {
    setValue(v);
    setSaved(false);
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addressForm: v }),
    }).catch(() => null);
    if (res?.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div>
      <p className="mb-2 text-xs font-bold text-[color:var(--primary)]/70">
        🗣️ איך לפנות אליך באתר (כולל קלוד):
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            onClick={() => pick(o.value)}
            title={o.example}
            className={[
              "rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
              value === o.value
                ? "border-[color:var(--primary)] bg-[color:var(--primary)] text-white"
                : "border-[color:var(--border)] text-[color:var(--primary)] hover:border-[color:var(--accent)]",
            ].join(" ")}
          >
            {o.label}
          </button>
        ))}
        {saved && <span className="text-xs text-[color:var(--success)]">נשמר ✓</span>}
      </div>
    </div>
  );
}
