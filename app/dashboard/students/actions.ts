"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  approveUser,
  blockUser,
  preApproveEmail,
  removeUser,
  renameUser,
  unblockUser,
} from "@/lib/approval";
import { mergeAccounts, unmergeAccounts } from "@/lib/account-merge";

// Roster actions — real teachers only (the session role comes from the
// lib/roles.ts whitelist, never from user input).
async function requireTeacher(): Promise<boolean> {
  const session = await auth();
  return session?.user?.role === "teacher";
}

const done = () => {
  revalidatePath("/dashboard/students");
  revalidatePath("/dashboard");
};

export async function approveAction(userId: number) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  await approveUser(userId);
  done();
  return { ok: true };
}

export async function blockAction(userId: number) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  await blockUser(userId);
  done();
  return { ok: true };
}

export async function unblockAction(userId: number) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  await unblockUser(userId);
  done();
  return { ok: true };
}

export async function removeAction(userId: number) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  await removeUser(userId);
  done();
  return { ok: true };
}

export async function preApproveAction(emails: string) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד.", added: 0 };
  const list = emails
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  let added = 0;
  for (const e of list) {
    if (await preApproveEmail(e)) added += 1;
  }
  done();
  return { ok: true, added };
}

// ---------- names and account merges (issue #19) ----------

// a name or a merge shows up everywhere (class pulse, submissions, messages)
const doneEverywhere = () => revalidatePath("/", "layout");

export async function renameAction(userId: number, fullName: string) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  const name = fullName.replace(/\s+/g, " ").trim();
  if (!name) return { ok: false, error: "השם ריק." };
  if (name.length > 80) return { ok: false, error: "השם ארוך מדי." };
  await renameUser(userId, name);
  doneEverywhere();
  return { ok: true };
}

export async function mergeAction(primaryId: number, secondaryId: number, fullName: string) {
  const session = await auth();
  if (session?.user?.role !== "teacher") return { ok: false, error: "למורות בלבד." };
  const r = await mergeAccounts({
    primaryId,
    secondaryId,
    fullName: fullName.replace(/\s+/g, " ").trim().slice(0, 80),
    teacherId: Number(session.user.id),
  });
  if (r.ok) doneEverywhere();
  return r;
}

export async function unmergeAction(mergeId: number) {
  if (!(await requireTeacher())) return { ok: false, error: "למורות בלבד." };
  const r = await unmergeAccounts(mergeId);
  if (r.ok) doneEverywhere();
  return r;
}
