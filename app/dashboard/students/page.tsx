import { auth } from "@/auth";
import { redirect } from "next/navigation";
import PageShell from "@/components/page-shell";
import StudentsAdmin from "@/components/dashboard/students-admin";
import { listAccounts } from "@/lib/approval";

// The class roster — every account that ever signed in, grouped by state:
// waiting for approval, approved, blocked. Teachers approve, block or
// remove; strangers who wandered in with a Google account are removed here.
export default async function StudentsPage() {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");

  const accounts = await listAccounts();
  const pending = accounts.filter((a) => a.state === "pending" && a.role !== "teacher");
  const approved = accounts.filter((a) => a.state === "approved" && a.role !== "teacher");
  const blocked = accounts.filter((a) => a.state === "blocked");
  const teachers = accounts.filter((a) => a.role === "teacher");

  return (
    <PageShell
      title="רשימת התלמידים"
      subtitle={`${approved.length} מאושרים · ${pending.length} ממתינים לאישור · ${blocked.length} חסומים`}
    >
      <StudentsAdmin
        pending={pending}
        approved={approved}
        blocked={blocked}
        teachers={teachers}
      />
    </PageShell>
  );
}
