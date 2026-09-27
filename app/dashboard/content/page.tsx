import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import { TASK_REGISTRY } from "@/content/tasks/registry";
import { getOverrides, applyOverrides } from "@/lib/content-overrides";

// תוכן השיעורים — one place to read and edit, for every lesson in the
// library, the teacher-editable layer: the comprehension check, the open
// question, the plenary question and the opening deck. What Claude wrote
// is only the default; anything edited here (or in place, anywhere on the
// site) is marked and wins.
export default async function ContentHubPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const rows = await Promise.all(
    Object.entries(TASK_REGISTRY).map(async ([ref, reg]) => {
      const ov = await getOverrides(ref);
      const c = applyOverrides(reg.content, ov);
      return {
        ref,
        title: c.title,
        bookRef: c.bookRef,
        checkCount: c.check?.length ?? 0,
        hasOpen: Boolean(c.checkOpen),
        hasPlenary: Boolean(c.plenary?.question),
        hasOpening: Boolean(c.opening?.opener),
        edited: Object.keys(ov),
      };
    })
  );

  return (
    <PageShell
      title="תוכן השיעורים"
      subtitle="בדיקת ההבנה, השאלה הפתוחה, שאלת המליאה ואור פותח — לכל שיעור. מה שנכתב הוא ברירת מחדל; כל מה שתערכי גובר עליו"
    >
      <div className="mx-auto max-w-3xl space-y-3">
        {rows.map((r) => (
          <Link
            key={r.ref}
            href={`/dashboard/content/${r.ref}`}
            className="block rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 transition hover:border-[color:var(--accent)]"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base font-bold text-[color:var(--primary)]">
                  {r.title}
                </p>
                <p className="text-xs text-[color:var(--primary)]/55">{r.bookRef}</p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
                <Pill ok={r.checkCount > 0} label={r.checkCount > 0 ? `✅ צ'ק · ${r.checkCount} שאלות` : "צ'ק — חסר"} />
                <Pill ok={r.hasOpen} label="פתוחה" />
                <Pill ok={r.hasPlenary} label="💬 מליאה" />
                <Pill ok={r.hasOpening} label="✨ פתיחה" />
                {r.edited.length > 0 && (
                  <span className="rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[color:var(--accent)]">
                    ✏️ נערך ידנית
                  </span>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 ${
        ok
          ? "bg-[color:var(--success)]/12 text-[color:var(--success)]"
          : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
      }`}
    >
      {label}
    </span>
  );
}
