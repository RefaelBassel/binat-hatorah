import Link from "next/link";
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import PageShell from "@/components/page-shell";
import { getTaskContent } from "@/content/tasks/registry";
import { getOverrides, applyOverrides } from "@/lib/content-overrides";
import { db } from "@/lib/db";
import CheckEditor from "@/components/task/check-editor";
import { PlenaryEditor } from "@/components/task/thinking-card";
import { OpeningEditor } from "@/components/opening-deck";

// One lesson's teacher-editable layer, all editors on one page. The same
// editors appear in place across the site (stage 7 of the task, the
// thinking card, the closing screen, the opening deck) — this is the
// gathered view, handy for reviewing a whole lesson before class.
export default async function ContentEditPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { ref } = await params;
  const reg = getTaskContent(ref);
  if (!reg) notFound();
  const ov = await getOverrides(ref);
  const content = applyOverrides(reg.content, ov);

  // a published task for this content (if any) — for the live previews
  const t = await db().execute({
    sql: "SELECT id FROM tasks WHERE content_ref = ? ORDER BY id DESC LIMIT 1",
    args: [ref],
  });
  const taskId = t.rows[0] ? Number(t.rows[0].id) : null;

  return (
    <PageShell title={content.title} subtitle={`${content.bookRef} · תוכן השיעור`}>
      <div className="mx-auto max-w-3xl space-y-8">
        <p className="flex flex-wrap items-center gap-4 text-sm">
          <Link href="/dashboard/content" className="font-semibold text-[color:var(--accent)] hover:underline">
            → לכל השיעורים
          </Link>
          {taskId != null && (
            <>
              <Link href={`/dashboard/opening/${taskId}`} target="_blank" className="font-semibold text-[color:var(--primary)] hover:underline">
                ✨ תצוגת אור פותח
              </Link>
              <Link href={`/dashboard/close/${taskId}`} target="_blank" className="font-semibold text-[color:var(--primary)] hover:underline">
                🧭 מסך הסגירה
              </Link>
              <Link href={`/tasks/${taskId}`} className="font-semibold text-[color:var(--primary)] hover:underline">
                👀 המשימה כפי שהכיתה רואה
              </Link>
            </>
          )}
        </p>

        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold text-[color:var(--primary)]">
            ✅ בדיקת ההבנה (שלב 7)
            {ov.check && <EditedTag />}
          </h2>
          <CheckEditor
            contentRef={ref}
            initialCheck={content.check ?? []}
            initialOpen={content.checkOpen ?? null}
          />
        </section>

        <section className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
          <h2 className="font-display text-lg font-extrabold text-[color:var(--primary)]">
            💬 שאלת המליאה
            {ov.plenary && <EditedTag />}
          </h2>
          <p className="text-xs text-[color:var(--foreground)]/60">
            לתלמידים היא מופיעה ככרטיס ״שאלה למחשבה״ אחרי חלק ב; לך — במסך הסגירה ובשקף האחרון של אור פותח.
          </p>
          <PlenaryEditor contentRef={ref} initial={content.plenary ?? null} />
        </section>

        <section>
          <h2 className="mb-2 font-display text-lg font-extrabold text-[color:var(--primary)]">
            ✨ אור פותח
            {ov.opening && <EditedTag />}
          </h2>
          <OpeningEditor contentRef={ref} initial={content.opening ?? null} />
        </section>
      </div>
    </PageShell>
  );
}

function EditedTag() {
  return (
    <span className="ms-2 align-middle rounded-full bg-[color:var(--accent)]/15 px-2 py-0.5 text-[10px] font-bold text-[color:var(--accent)]">
      ✏️ נערך ידנית
    </span>
  );
}
