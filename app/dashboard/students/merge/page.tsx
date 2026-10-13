import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import PageShell from "@/components/page-shell";
import MergeConfirm from "@/components/dashboard/merge-confirm";
import { mergeSide } from "@/lib/account-merge";

// Confirmation screen for merging two accounts of one student (#19): both
// accounts side by side — name, emails, last sign-in, every task and its
// state — then the teacher picks the primary account and the display name.
export default async function MergePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const { a, b } = await searchParams;
  const ids = [Number(a), Number(b)];
  const sides =
    ids.every((id) => Number.isInteger(id) && id > 0) && ids[0] !== ids[1]
      ? await Promise.all(ids.map((id) => mergeSide(id)))
      : [];
  const [left, right] = sides;
  const problem =
    !left || !right
      ? "אחד החשבונות לא נמצא."
      : left.role !== "student" || right.role !== "student"
        ? "אי אפשר לאחד חשבון של מורה."
        : left.mergedInto != null || right.mergedInto != null
          ? "אחד החשבונות כבר אוחד לחשבון אחר."
          : null;

  return (
    <PageShell title="איחוד חשבונות" subtitle="שני חשבונות גוגל של אותו תלמיד — לחשבון אחד">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard/students"
          className="mb-4 inline-block text-sm font-semibold text-[color:var(--accent)] hover:underline"
        >
          → חזרה לרשימת התלמידים
        </Link>
        {problem || !left || !right ? (
          <p className="rounded-2xl border border-[color:var(--danger)]/40 bg-[color:var(--card)] p-5 text-sm text-[color:var(--danger)]">
            {problem}
          </p>
        ) : (
          <MergeConfirm left={left} right={right} />
        )}
      </div>
    </PageShell>
  );
}
