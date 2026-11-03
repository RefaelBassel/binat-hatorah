"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import SaveButton from "@/components/save-button";
import ExamDocEditor from "./exam-doc-editor";
import PrepDocEditor from "./prep-doc-editor";
import NikudPalette from "./nikud-palette";
import PublishPanel from "./publish-panel";
import VersionsPanel from "./versions-panel";
import ActionButton, { postJson } from "./action-button";
import { formatHebTime } from "@/lib/hebrew";
import type { ExamDoc, PrepDoc } from "@/lib/exams-types";

type Related = { id: number; title: string; status: "draft" | "published" };
type AutoState = "idle" | "pending" | "saving" | "saved" | "error";

const AUTOSAVE_MS = 2000;

export default function EditorClient({
  examId,
  kind,
  initialTitle,
  initialDoc,
  initialStatus,
  initialOpensAt,
  initialDuration,
  attemptCount,
  related,
}: {
  examId: number;
  kind: "exam" | "prep";
  initialTitle: string;
  initialDoc: ExamDoc | PrepDoc;
  initialStatus: "draft" | "published";
  initialOpensAt: number | null;
  initialDuration: number | null;
  attemptCount: number;
  related: Related[]; // exam: its prep sheets · prep: the exam it belongs to
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [doc, setDoc] = useState<ExamDoc | PrepDoc>(initialDoc);
  const [auto, setAuto] = useState<AutoState>("idle");
  const [autoAt, setAutoAt] = useState<number | null>(null);
  const [autoError, setAutoError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const serialize = (t: string, d: ExamDoc | PrepDoc) => JSON.stringify({ t, d });
  const savedRef = useRef(serialize(initialTitle, initialDoc));
  const latestRef = useRef({ title: initialTitle, doc: initialDoc });
  const chain = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<number | null>(null);

  useEffect(() => {
    latestRef.current = { title, doc };
    const changed = serialize(title, doc) !== savedRef.current;
    setDirty(changed);
    if (!changed) return;
    setAuto("pending");
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void persist(false).catch(() => undefined);
    }, AUTOSAVE_MS);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // persist only reads refs, so it is stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, doc]);

  // Saves the latest state; saves run one after another so an older response
  // can never overwrite a newer one. Throws on failure.
  const persist = useCallback(
    (manual: boolean): Promise<void> => {
      const run = async () => {
        const { title: t, doc: d } = latestRef.current;
        const snapshot = serialize(t, d);
        if (snapshot === savedRef.current && !manual) return;
        setAuto("saving");
        try {
          await postJson(`/api/exams/${examId}`, { title: t, doc: d, manual }, "PUT");
          savedRef.current = snapshot;
          const stillDirty = serialize(latestRef.current.title, latestRef.current.doc) !== snapshot;
          setDirty(stillDirty);
          setAuto(stillDirty ? "pending" : "saved");
          setAutoAt(Math.floor(Date.now() / 1000));
          setAutoError(null);
        } catch (e) {
          setAuto("error");
          setAutoError(e instanceof Error ? e.message : "השמירה האוטומטית נכשלה");
          throw e;
        }
      };
      const next = chain.current.then(run, run);
      chain.current = next.catch(() => undefined);
      return next;
    },
    [examId]
  );

  // brings the DB up to date before print / publish / history read it
  const flush = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    await persist(false);
  }, [persist]);

  const openPrint = async (mode: "exam" | "rubric" | "prep") => {
    // open the tab inside the click (pop-up blockers), then point it at the
    // print page once the newest edits are saved
    const w = window.open("", "_blank");
    try {
      await flush();
    } catch {
      w?.close();
      throw new Error("לא הצלחנו לשמור לפני ההדפסה — נסו שוב");
    }
    if (w) w.location.href = `/dashboard/exams/${examId}/print?mode=${mode}`;
    else throw new Error("הדפדפן חסם את החלון — אפשרו חלונות קופצים לאתר");
  };

  const duplicate = async () => {
    await flush();
    const data = await postJson<{ id: number }>("/api/exams", { action: "duplicate", id: examId });
    router.push(`/dashboard/exams/${data.id}`);
  };

  const remove = async () => {
    await postJson(`/api/exams/${examId}`, {}, "DELETE");
    router.push("/dashboard/exams");
  };

  const createPrep = async () => {
    await flush();
    const data = await postJson<{ id: number }>("/api/exams", {
      kind: "prep",
      linkedExamId: examId,
      title: `דף הכנה: ${title}`.slice(0, 300),
    });
    router.push(`/dashboard/exams/${data.id}`);
  };

  const autoText =
    auto === "saving"
      ? "שומר אוטומטית…"
      : auto === "pending"
        ? "ממתין לשמירה אוטומטית…"
        : auto === "saved" && autoAt
          ? `נשמר אוטומטית בשעה ${formatHebTime(autoAt)}`
          : auto === "error"
            ? (autoError ?? "השמירה האוטומטית נכשלה") + " — לחצו על שמירה"
            : "השינויים נשמרים אוטומטית";

  return (
    <div id="exam-editor" className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href="/dashboard/exams" className="font-bold text-[color:var(--accent)] hover:underline">
          ← חזרה לרשימת המבחנים
        </Link>
        {related.map((r) => (
          <Link
            key={r.id}
            href={`/dashboard/exams/${r.id}`}
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1 text-xs font-bold text-[color:var(--primary)] hover:border-[color:var(--accent)]"
          >
            {kind === "exam" ? "דף ההכנה המקושר" : "המבחן המקושר"}: {r.title}
          </Link>
        ))}
        {kind === "exam" && related.length === 0 && (
          <ActionButton tone="plain" busyLabel="יוצר…" doneLabel="נוצר" onClick={createPrep}>
            + יצירת דף הכנה מקושר
          </ActionButton>
        )}
      </div>

      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <label className="mb-1 block text-xs font-bold text-[color:var(--foreground)]/65">
          {kind === "prep" ? "כותרת דף ההכנה" : "כותרת המבחן"}
        </label>
        <input
          dir="rtl"
          lang="he"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="כותרת"
          className="w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-2 font-display text-xl font-extrabold text-[color:var(--primary)] outline-none focus:border-[color:var(--accent)]"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SaveButton
            dirty={dirty}
            onSave={() => persist(true)}
            label="שמירה"
            idleLabel="הכול שמור"
          />
          <span
            className={`text-xs font-semibold ${
              auto === "error" ? "text-[color:var(--danger)]" : "text-[color:var(--foreground)]/60"
            }`}
            role="status"
          >
            {autoText}
          </span>
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center gap-3">
        {kind === "exam" ? (
          <>
            <ActionButton tone="plain" busyLabel="פותח…" doneLabel="נפתח" onClick={() => openPrint("exam")}>
              🖨 הדפסה / PDF
            </ActionButton>
            <ActionButton tone="plain" busyLabel="פותח…" doneLabel="נפתח" onClick={() => openPrint("rubric")}>
              🖨 הדפסת המחוון
            </ActionButton>
          </>
        ) : (
          <ActionButton tone="plain" busyLabel="פותח…" doneLabel="נפתח" onClick={() => openPrint("prep")}>
            🖨 הדפסת דף ההכנה
          </ActionButton>
        )}
        <ActionButton tone="plain" busyLabel="משכפל…" doneLabel="שוכפל" onClick={duplicate}>
          שכפול
        </ActionButton>
        {initialStatus === "draft" && attemptCount === 0 && (
          <ActionButton
            tone="danger"
            busyLabel="מוחק…"
            doneLabel="נמחק"
            confirmMessage="למחוק לצמיתות? אי אפשר לשחזר."
            onClick={remove}
          >
            מחיקה
          </ActionButton>
        )}
      </div>

      <VersionsPanel
        examId={examId}
        flush={flush}
        onRestored={(t, d) => {
          savedRef.current = serialize(t, d);
          latestRef.current = { title: t, doc: d };
          setTitle(t);
          setDoc(d);
          setDirty(false);
          setAuto("saved");
          setAutoAt(Math.floor(Date.now() / 1000));
        }}
      />

      <div className="no-print rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
        <NikudPalette containerId="exam-editor" />
      </div>

      {kind === "exam" ? (
        <ExamDocEditor doc={doc as ExamDoc} onChange={setDoc} />
      ) : (
        <PrepDocEditor doc={doc as PrepDoc} onChange={setDoc} />
      )}

      <PublishPanel
        examId={examId}
        kind={kind}
        initialStatus={initialStatus}
        initialOpensAt={initialOpensAt}
        initialDuration={initialDuration}
        attemptCount={attemptCount}
        flush={flush}
        docDuration={kind === "exam" ? (doc as ExamDoc).durationMin : null}
      />

      {kind === "exam" && attemptCount > 0 && (
        <Link
          href={`/dashboard/exams/${examId}/submissions`}
          className="inline-block rounded-full bg-[color:var(--primary-fill)] px-5 py-2 text-sm font-bold text-white"
        >
          להגשות המבחן ({attemptCount})
        </Link>
      )}
    </div>
  );
}
