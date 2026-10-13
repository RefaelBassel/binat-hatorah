"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = { userId: number; name: string; score: number | null };

// Approve several reviewed proposals at once. Each student gets the
// teacher's saved draft if there is one, otherwise Claude's proposal as is —
// and is notified by bell + email, exactly like a single approval.
export default function BulkApprove({ taskId, rows }: { taskId: number; rows: Row[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  if (rows.length === 0 && !note) return null;

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = rows.length > 0 && selected.size === rows.length;

  const approve = async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/grade/approve-many", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, userIds: [...selected] }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setNote({ ok: false, text: data?.error ?? "שגיאה באישור — נסי שוב." });
      } else {
        setNote({
          ok: true,
          text:
            `✅ ${data.approved} ציונים אושרו והוחזרו לתלמידים.` +
            (data.skipped > 0 ? ` ${data.skipped} דולגו (אין ציון לאישור).` : ""),
        });
        setSelected(new Set());
        router.refresh();
      }
    } catch {
      setNote({ ok: false, text: "שגיאה בחיבור — נסי שוב." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-8 rounded-2xl border-2 border-[color:var(--warning)]/40 bg-[color:var(--card)] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[color:var(--primary)]">
            ✨ הצעות ממתינות לאישור ({rows.length})
          </p>
          <p className="mt-1 text-xs text-[color:var(--foreground)]/65">
            התלמידים לא רואים דבר עד האישור. אחרי שעברת על ההצעות אפשר לסמן כמה
            ולאשר יחד.
          </p>
        </div>
        {rows.length > 0 && (
          <Link
            href={`/dashboard/submission/${taskId}/${rows[0].userId}`}
            className="shrink-0 rounded-full bg-[color:var(--primary)] px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02]"
          >
            מעבר להגשה הראשונה שממתינה ←
          </Link>
        )}
      </div>
      {rows.length > 0 && (
        <>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-[color:var(--primary)]/70">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.userId)))}
            />
            בחירת הכל
          </label>
          <ul className="mb-3 grid gap-1.5 sm:grid-cols-2">
            {rows.map((r) => (
              <li key={r.userId}>
                <label className="flex items-center gap-2 rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={selected.has(r.userId)}
                    onChange={() => toggle(r.userId)}
                  />
                  <span className="font-semibold text-[color:var(--primary)]">{r.name}</span>
                  <span className="ms-auto text-xs font-bold text-[color:var(--primary)]/70">
                    {r.score != null ? `ציון: ${r.score}` : "אין ציון"}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {rows.length > 0 && (
          <button
            onClick={approve}
            disabled={busy || selected.size === 0}
            className="rounded-full bg-[color:var(--success)] px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-40"
          >
            {busy
              ? "מאשרים..."
              : selected.size === 0
                ? "סמני הגשות לאישור"
                : `אישור והחזרה של ${selected.size} הגשות 📨`}
          </button>
        )}
        {note && (
          <p
            className={`text-xs font-semibold ${
              note.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"
            }`}
          >
            {note.text}
          </p>
        )}
      </div>
    </div>
  );
}
