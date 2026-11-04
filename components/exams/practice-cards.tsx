import Link from "next/link";
import { openPractices } from "@/lib/practice";

// "📚 תרגול למבחן" — one prominent card per exam whose practice the teacher
// opened (issue #34). Shown on /tasks and /exams.
export default async function PracticeCards({ className = "" }: { className?: string }) {
  let list: { id: number; title: string }[] = [];
  try {
    list = await openPractices();
  } catch {
    return null; // DB unavailable
  }
  if (list.length === 0) return null;
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>
      {list.map((p) => (
        <Link
          key={p.id}
          href={`/exams/practice/${p.id}`}
          className="group flex items-center gap-4 rounded-2xl border-2 border-[color:var(--accent)]/60 bg-gradient-to-l from-[color:var(--accent)]/15 to-[color:var(--card)] p-5 shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
        >
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--accent-fill)] text-3xl text-white shadow">
            📚
          </span>
          <span className="min-w-0">
            <span className="block font-display text-xl font-bold text-[color:var(--primary)]">תרגול למבחן</span>
            <span className="block truncate text-sm text-[color:var(--foreground)]/75">{p.title}</span>
            <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[color:var(--accent)]">
              חידון, כרטיסיות, שאלות פתוחות ומבחן לדוגמה
              <span aria-hidden className="transition group-hover:-translate-x-0.5">←</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}
