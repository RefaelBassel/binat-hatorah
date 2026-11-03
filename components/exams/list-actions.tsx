"use client";

import { useRouter } from "next/navigation";
import ActionButton, { postJson } from "./action-button";

export function NewExamButton() {
  const router = useRouter();
  return (
    <ActionButton
      tone="accent"
      busyLabel="יוצר…"
      doneLabel="נוצר"
      onClick={async () => {
        const data = await postJson<{ id: number }>("/api/exams", { kind: "exam" });
        router.push(`/dashboard/exams/${data.id}`);
      }}
    >
      + מבחן חדש
    </ActionButton>
  );
}

export function DuplicateButton({ id }: { id: number }) {
  const router = useRouter();
  return (
    <ActionButton
      tone="plain"
      busyLabel="משכפל…"
      doneLabel="שוכפל"
      onClick={async () => {
        const data = await postJson<{ id: number }>("/api/exams", { action: "duplicate", id });
        router.push(`/dashboard/exams/${data.id}`);
      }}
    >
      שכפול
    </ActionButton>
  );
}
