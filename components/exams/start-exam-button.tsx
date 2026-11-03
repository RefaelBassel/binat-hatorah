"use client";

import { useRouter } from "next/navigation";
import ActionButton, { postJson } from "./action-button";

// Starting is an explicit click — the clock starts only then.
export default function StartExamButton({ examId, minutes }: { examId: number; minutes: number | null }) {
  const router = useRouter();
  return (
    <ActionButton
      tone="accent"
      busyLabel="מתחיל…"
      doneLabel="מתחילים!"
      confirmMessage={`להתחיל את המבחן? הטיימר${minutes ? ` (${minutes} דקות)` : ""} יתחיל לרוץ מיד, ואי אפשר לעצור אותו.`}
      onClick={async () => {
        await postJson(`/api/exams/${examId}/attempt`, { action: "start" });
        router.refresh();
      }}
    >
      התחלת המבחן
    </ActionButton>
  );
}
