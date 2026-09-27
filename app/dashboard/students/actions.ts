"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import {
  approveUser,
  blockUser,
  preApproveEmail,
  removeUser,
  unblockUser,
} from "@/lib/approval";

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
