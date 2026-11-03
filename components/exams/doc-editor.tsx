"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  type DocKind,
  type ExamBody,
  type ExamPart,
  type ExamQuestion,
  type PrepBlock,
  type PrepBlockType,
  type PrepBody,
  examTotal,
  newId,
  partComputedPoints,
  partLabel,
  questionNumbers,
  questionPoints,
  subLabel,
} from "@/lib/exam-types";
import { AddButton, NikudBar, NumField, SortRow, TextField, move, trackFocus } from "./editor-kit";
import PublishPanel from "./publish-panel";

type SaveState = "saved" | "pending" | "saving" | "error";

export interface EditorDoc {
  id: number;
  kind: DocKind;
  title: string;
  durationMin: number | null;
  body: ExamBody | PrepBody;
  publishedAt: number | null;
  opensAt: number | null;
  prepId: number | null;
  prepTitle: string | null;
  linkedExamId: number | null;
  attemptCount: number;
}

export default function DocEditor({ doc }: { doc: EditorDoc }) {
  const router = useRouter();
  const [title, setTitle] = useState(doc.title);
  const [durationMin, setDurationMin] = useState<number | null>(doc.durationMin);
  const [body, setBody] = useState<ExamBody | PrepBody>(doc.body);
  const [save, setSave] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const version = useRef(0); // bumps on every edit
  // what the server has — an unchanged state (first render, a restore, an
  // edit that was undone) needs no save
  const savedSnap = useRef(JSON.stringify({ title: doc.title, durationMin: doc.durationMin, body: doc.body }));

  const latest = useRef({ title, durationMin, body });
  useEffect(() => {
    latest.current = { title, durationMin, body };
  }, [title, durationMin, body]);

  const persist = useCallback(async () => {
    const v = version.current;
    const snap = JSON.stringify(latest.current);
    setSave("saving");
    try {
      const res = await fetch(`/api/exams/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: snap,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "לא נשמר");
      savedSnap.current = snap;
      setSavedAt(Date.now());
      setSaveError(null);
      // newer edits arrived while saving → they get their own save
      setSave(version.current === v ? "saved" : "pending");
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "לא נשמר");
      setSave("error");
    }
  }, [doc.id]);

  // autosave 1.2s after the last edit
  useEffect(() => {
    if (JSON.stringify({ title, durationMin, body }) === savedSnap.current) {
      setSave((s) => (s === "pending" ? "saved" : s));
      return;
    }
    version.current++;
    setSave("pending");
    const t = window.setTimeout(persist, 1200);
    return () => window.clearTimeout(t);
  }, [title, durationMin, body, persist]);

  useEffect(() => {
    if (save === "saved") return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [save]);

  const applyRestored = (data: { title: string; durationMin: number | null; body: ExamBody | PrepBody }) => {
    savedSnap.current = JSON.stringify(data);
    setTitle(data.title);
    setDurationMin(data.durationMin);
    setBody(data.body);
    setSave("saved");
    setSavedAt(Date.now());
  };

  const isExam = doc.kind === "exam";

  return (
    <div onFocusCapture={trackFocus} className="space-y-5">
      {/* toolbar */}
      <div className="sticky top-2 z-20 space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)]/95 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/dashboard/exams" className="text-sm font-semibold text-[color:var(--primary)] underline">
              ← לכל המבחנים
            </Link>
            <SaveIndicator state={save} error={saveError} savedAt={savedAt} onRetry={persist} />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isExam && <TotalBadge body={body as ExamBody} />}
            <VersionsButton docId={doc.id} onRestored={applyRestored} disabled={save === "saving"} />
          </div>
        </div>
        <NikudBar />
      </div>

      {/* title + meta */}
      <div className="space-y-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4">
        <label className="block text-xs font-semibold text-[color:var(--foreground)]/70">
          {isExam ? "כותרת המבחן" : "כותרת דף ההכנה"}
          <input
            type="text"
            dir="rtl"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 font-display text-xl font-bold text-[color:var(--foreground)] outline-none focus:border-[color:var(--primary)]"
          />
        </label>
        {isExam && (
          <div className="flex flex-wrap items-center gap-4">
            <NumField label="זמן המבחן (דקות)" value={durationMin} onChange={setDurationMin} width="w-24" />
            <PrepLink doc={doc} />
          </div>
        )}
        {!isExam && doc.linkedExamId != null && (
          <p className="text-sm">
            מקושר למבחן ·{" "}
            <Link href={`/dashboard/exams/${doc.linkedExamId}`} className="font-semibold text-[color:var(--primary)] underline">
              מעבר לעריכת המבחן
            </Link>
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          {isExam ? (
            <>
              <PrintLink href={`/dashboard/exams/print/${doc.id}`}>הדפסה / PDF</PrintLink>
              <PrintLink href={`/dashboard/exams/print/${doc.id}?mode=rubric`}>הדפסת המחוון</PrintLink>
              {doc.prepId != null && (
                <PrintLink href={`/dashboard/exams/print/${doc.prepId}`}>הדפסת דף ההכנה</PrintLink>
              )}
              <Link
                href={`/dashboard/exams/${doc.id}/submissions`}
                className="rounded-full bg-[color:var(--primary-fill)] px-4 py-1.5 text-xs font-bold text-white shadow transition hover:scale-[1.02]"
              >
                הגשות ({doc.attemptCount})
              </Link>
            </>
          ) : (
            <PrintLink href={`/dashboard/exams/print/${doc.id}`}>הדפסת דף ההכנה / PDF</PrintLink>
          )}
        </div>
      </div>

      <PublishPanel
        docId={doc.id}
        kind={doc.kind}
        publishedAt={doc.publishedAt}
        opensAt={doc.opensAt}
        durationMin={durationMin}
        onChanged={() => router.refresh()}
      />

      {isExam ? (
        <ExamBodyEditor body={body as ExamBody} setBody={(b) => setBody(b)} />
      ) : (
        <PrepBodyEditor body={body as PrepBody} setBody={(b) => setBody(b)} />
      )}
    </div>
  );
}

function PrintLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener"
      className="rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10"
    >
      🖨 {children}
    </a>
  );
}

function SaveIndicator({
  state,
  error,
  savedAt,
  onRetry,
}: {
  state: SaveState;
  error: string | null;
  savedAt: number | null;
  onRetry: () => void;
}) {
  if (state === "saving")
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--accent)]">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[color:var(--accent)]/30 border-t-[color:var(--accent)]" />
        שומר…
      </span>
    );
  if (state === "pending")
    return <span className="text-xs font-semibold text-[color:var(--warning)]">● יש שינויים, נשמר אוטומטית בעוד רגע</span>;
  if (state === "error")
    return (
      <span className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--danger)]">
        ✕ {error ?? "לא נשמר"}
        <button type="button" onClick={onRetry} className="rounded-full bg-[color:var(--danger-fill)] px-3 py-0.5 text-white">
          ניסיון חוזר
        </button>
      </span>
    );
  return (
    <span className="text-xs font-semibold text-[color:var(--success)]">
      ✓ {savedAt ? `נשמר אוטומטית ב־${new Date(savedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}` : "כל השינויים שמורים"}
    </span>
  );
}

function TotalBadge({ body }: { body: ExamBody }) {
  const total = examTotal(body);
  const ok = Math.abs(total - 100) < 0.001;
  return (
    <span
      className={`rounded-full px-4 py-1.5 text-sm font-bold ${
        ok
          ? "bg-[color:var(--success)]/15 text-[color:var(--success)]"
          : "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
      }`}
      title={ok ? "" : "הסכום הכולל של הנקודות אינו 100"}
    >
      סך הכול: {Number.isInteger(total) ? total : total.toFixed(1)} נקודות {ok ? "✓" : "⚠ לא 100"}
    </span>
  );
}

function PrepLink({ doc }: { doc: EditorDoc }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (doc.prepId != null) {
    return (
      <span className="text-sm">
        דף הכנה מקושר:{" "}
        <Link href={`/dashboard/exams/${doc.prepId}`} className="font-semibold text-[color:var(--primary)] underline">
          {doc.prepTitle || "דף הכנה"} (עריכה)
        </Link>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          try {
            const res = await fetch("/api/exams", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "createPrep", examId: doc.id }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            router.push(`/dashboard/exams/${data.id}`);
          } catch (e) {
            setErr(e instanceof Error && e.message ? e.message : "לא נוצר. נסו שוב.");
            setBusy(false);
          }
        }}
        className="rounded-full border border-dashed border-[color:var(--primary)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] disabled:opacity-60"
      >
        {busy ? "יוצר דף הכנה…" : "+ יצירת דף הכנה מקושר"}
      </button>
      {err && <span className="text-xs text-[color:var(--danger)]">{err}</span>}
    </span>
  );
}

function VersionsButton({
  docId,
  onRestored,
  disabled,
}: {
  docId: number;
  onRestored: (d: { title: string; durationMin: number | null; body: ExamBody | PrepBody }) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<{ id: number; createdAt: number; updatedAt: number }[] | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/exams/${docId}/versions`);
      const data = await res.json();
      setVersions(data.versions ?? []);
    } catch {
      setMsg({ ok: false, text: "לא נטען. נסו שוב." });
    }
    setLoading(false);
  };

  const fmt = (s: number) =>
    new Date(s * 1000).toLocaleString("he-IL", {
      day: "numeric",
      month: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Jerusalem",
    });

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) load();
        }}
        className="rounded-full border-2 border-[color:var(--primary)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/10 disabled:opacity-50"
      >
        ↶ החזרה לגרסה קודמת
      </button>
      {open && (
        <div className="absolute end-0 top-full z-30 mt-2 w-80 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 shadow-xl">
          <p className="mb-2 text-xs text-[color:var(--foreground)]/70">
            כל גרסה נשמרת אוטומטית (גרסה חדשה כל 10 דקות של עריכה). השחזור שומר קודם את הנוסח הנוכחי כגרסה, כך שאפשר לחזור אליו.
          </p>
          {loading && <p className="text-sm">טוען…</p>}
          {msg && (
            <p className={`text-sm font-semibold ${msg.ok ? "text-[color:var(--success)]" : "text-[color:var(--danger)]"}`}>{msg.text}</p>
          )}
          {versions && versions.length === 0 && <p className="text-sm">אין עדיין גרסאות שמורות.</p>}
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {versions?.map((v, i) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 hover:bg-[color:var(--primary)]/5">
                <span className="text-sm">
                  {fmt(v.updatedAt)}
                  {i === 0 && <span className="ms-1 text-xs text-[color:var(--foreground)]/60">(העדכנית)</span>}
                </span>
                <button
                  type="button"
                  disabled={restoring != null}
                  onClick={async () => {
                    if (!window.confirm("לשחזר את הגרסה הזו? הנוסח הנוכחי יישמר כגרסה.")) return;
                    setRestoring(v.id);
                    setMsg(null);
                    try {
                      const res = await fetch(`/api/exams/${docId}/versions`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ versionId: v.id }),
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error);
                      onRestored({ title: data.title, durationMin: data.durationMin, body: JSON.parse(data.bodyJson) });
                      setMsg({ ok: true, text: "✓ הגרסה שוחזרה" });
                      load();
                    } catch {
                      setMsg({ ok: false, text: "השחזור נכשל. נסו שוב." });
                    }
                    setRestoring(null);
                  }}
                  className="rounded-full bg-[color:var(--accent-fill)] px-3 py-0.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {restoring === v.id ? "משחזר…" : "שחזור"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Exam body ───────────────────────────────────────────────────────────

const card = "rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm";

function newQuestion(): ExamQuestion {
  return { id: newId(), text: "", points: null, rubric: "", subs: [] };
}

function ExamBodyEditor({ body, setBody }: { body: ExamBody; setBody: (b: ExamBody) => void }) {
  const nums = questionNumbers(body);
  const setParts = (parts: ExamPart[]) => setBody({ ...body, parts });
  const updPart = (pi: number, patch: Partial<ExamPart>) =>
    setParts(body.parts.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  const updQ = (pi: number, qi: number, patch: Partial<ExamQuestion>) =>
    updPart(pi, { questions: body.parts[pi].questions.map((q, i) => (i === qi ? { ...q, ...patch } : q)) });

  return (
    <div className="space-y-4">
      {body.parts.map((p, pi) => {
        const computed = partComputedPoints(p);
        const mismatch = p.points != null && Math.abs(p.points - computed) > 0.001;
        return (
          <SortRow
            key={p.id}
            list="parts"
            index={pi}
            count={body.parts.length}
            onMove={(a, b) => setParts(move(body.parts, a, b))}
            onRemove={() => setParts(body.parts.filter((_, i) => i !== pi))}
            removeLabel={`למחוק את ${partLabel(pi)}`}
            className={`${card} border-s-4 !border-s-[color:var(--primary)]`}
          >
            {(tools) => (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-lg font-bold text-[color:var(--primary)]">{partLabel(pi)}</h3>
                  {tools}
                </div>
                <TextField label="כותרת החלק" placeholder="כותרת החלק" value={p.title} onChange={(v) => updPart(pi, { title: v })} className="font-bold" />
                <TextField label="הנחיה" placeholder="הנחיה לחלק (למשל: ענו על 4 מתוך 5 השאלות)" value={p.instructions} onChange={(v) => updPart(pi, { instructions: v })} />
                <div className="flex flex-wrap items-center gap-4">
                  <NumField label="ניקוד החלק" value={p.points} onChange={(v) => updPart(pi, { points: v })} />
                  <NumField
                    label="שאלות בחירה: לענות על"
                    placeholder="כולן"
                    value={p.choose}
                    onChange={(v) => updPart(pi, { choose: v == null ? null : Math.round(v) })}
                  />
                  <span className="text-xs text-[color:var(--foreground)]/70">
                    {p.choose ? `מתוך ${p.questions.length} · ` : ""}מחושב: {computed} נקודות
                  </span>
                  {mismatch && (
                    <span className="text-xs font-bold text-[color:var(--warning)]">
                      ⚠ ניקוד החלק ({p.points}) שונה מסכום השאלות ({computed})
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {p.questions.map((q, qi) => (
                    <SortRow
                      key={q.id}
                      list={`q:${p.id}`}
                      index={qi}
                      count={p.questions.length}
                      onMove={(a, b) => updPart(pi, { questions: move(p.questions, a, b) })}
                      onRemove={() => updPart(pi, { questions: p.questions.filter((_, i) => i !== qi) })}
                      removeLabel={`למחוק את שאלה ${nums.get(q.id)}`}
                      className="rounded-xl border border-[color:var(--border)] bg-[color:var(--background)]/60 p-3"
                    >
                      {(qtools) => (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-bold">שאלה {nums.get(q.id)}</span>
                            <div className="flex flex-wrap items-center gap-3">
                              <NumField
                                label="ניקוד"
                                placeholder={q.subs.length ? "לפי סעיפים" : ""}
                                width="w-24"
                                value={q.points}
                                onChange={(v) => updQ(pi, qi, { points: v })}
                              />
                              {q.points == null && q.subs.length > 0 && (
                                <span className="text-xs text-[color:var(--foreground)]/60">= {questionPoints(q)}</span>
                              )}
                              {qtools}
                            </div>
                          </div>
                          <TextField label="נוסח השאלה" placeholder="נוסח השאלה" value={q.text} minRows={1} onChange={(v) => updQ(pi, qi, { text: v })} />
                          <RubricField value={q.rubric} onChange={(v) => updQ(pi, qi, { rubric: v })} />

                          <div className="space-y-2 ps-4">
                            {q.subs.map((s, si) => (
                              <SortRow
                                key={s.id}
                                list={`s:${q.id}`}
                                index={si}
                                count={q.subs.length}
                                onMove={(a, b) => updQ(pi, qi, { subs: move(q.subs, a, b) })}
                                onRemove={() => updQ(pi, qi, { subs: q.subs.filter((_, i) => i !== si) })}
                                removeLabel={`למחוק את סעיף ${subLabel(si)}`}
                                className="rounded-lg border border-[color:var(--border)]/70 bg-[color:var(--card)] p-2"
                              >
                                {(stools) => (
                                  <div className="space-y-1.5">
                                    <div className="flex items-start gap-2">
                                      <span className="pt-1.5 font-semibold">{subLabel(si)}</span>
                                      <TextField
                                        label={`סעיף ${subLabel(si)}`}
                                        value={s.text}
                                        onChange={(v) =>
                                          updQ(pi, qi, { subs: q.subs.map((x, i) => (i === si ? { ...x, text: v } : x)) })
                                        }
                                      />
                                    </div>
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <NumField
                                        label="ניקוד הסעיף"
                                        placeholder="—"
                                        value={s.points}
                                        onChange={(v) =>
                                          updQ(pi, qi, { subs: q.subs.map((x, i) => (i === si ? { ...x, points: v } : x)) })
                                        }
                                      />
                                      {stools}
                                    </div>
                                    <RubricField
                                      value={s.rubric}
                                      onChange={(v) =>
                                        updQ(pi, qi, { subs: q.subs.map((x, i) => (i === si ? { ...x, rubric: v } : x)) })
                                      }
                                    />
                                  </div>
                                )}
                              </SortRow>
                            ))}
                            <div className="flex flex-wrap items-center gap-3">
                              <AddButton
                                onClick={() =>
                                  updQ(pi, qi, { subs: [...q.subs, { id: newId(), text: "", points: null, rubric: "" }] })
                                }
                              >
                                סעיף
                              </AddButton>
                              {q.subs.length > 1 && (
                                <NumField
                                  label="בחירה בין הסעיפים: לענות על"
                                  placeholder="כולם"
                                  value={q.chooseSubs ?? null}
                                  onChange={(v) => updQ(pi, qi, { chooseSubs: v == null ? null : Math.round(v) })}
                                />
                              )}
                            </div>
                            {(q.subs.length > 0 || q.footer) && (
                              <TextField
                                label="טקסט אחרי הסעיפים"
                                placeholder="טקסט אחרי הסעיפים (לא חובה)"
                                value={q.footer ?? ""}
                                onChange={(v) => updQ(pi, qi, { footer: v })}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    </SortRow>
                  ))}
                  <AddButton onClick={() => updPart(pi, { questions: [...p.questions, newQuestion()] })}>שאלה</AddButton>
                </div>
              </div>
            )}
          </SortRow>
        );
      })}
      <AddButton
        onClick={() =>
          setParts([
            ...body.parts,
            { id: newId(), title: "", instructions: "", points: null, choose: null, questions: [newQuestion()] },
          ])
        }
      >
        חלק חדש
      </AddButton>
    </div>
  );
}

function RubricField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(value.trim().length > 0);
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-[color:var(--success)] underline"
      >
        + תשובה לדוגמה / מחוון (רק המורה רואה)
      </button>
    );
  return (
    <div className="rounded-lg border-s-4 border-[color:var(--success)] bg-[color:var(--success)]/5 p-2">
      <p className="mb-1 text-xs font-bold text-[color:var(--success)]">🔒 תשובה לדוגמה / מחוון · רק המורה רואה</p>
      <TextField label="תשובה לדוגמה / מחוון" placeholder="אפשר להשאיר ריק" value={value} onChange={onChange} />
    </div>
  );
}

// ── Prep body ───────────────────────────────────────────────────────────

const BLOCK_TYPES: { type: PrepBlockType; label: string }[] = [
  { type: "heading", label: "כותרת" },
  { type: "text", label: "טקסט חופשי" },
  { type: "bullets", label: "רשימת תבליטים" },
  { type: "numbered", label: "רשימה ממוספרת" },
];

function PrepBodyEditor({ body, setBody }: { body: PrepBody; setBody: (b: PrepBody) => void }) {
  const setBlocks = (blocks: PrepBlock[]) => setBody({ ...body, blocks });
  const upd = (bi: number, patch: Partial<PrepBlock>) =>
    setBlocks(body.blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)));
  const add = (type: PrepBlockType) =>
    setBlocks([...body.blocks, { id: newId(), type, text: "", items: type === "bullets" || type === "numbered" ? [""] : [] }]);

  return (
    <div className="space-y-3">
      {body.blocks.map((b, bi) => {
        const isList = b.type === "bullets" || b.type === "numbered";
        return (
          <SortRow
            key={b.id}
            list="blocks"
            index={bi}
            count={body.blocks.length}
            onMove={(x, y) => setBlocks(move(body.blocks, x, y))}
            onRemove={() => setBlocks(body.blocks.filter((_, i) => i !== bi))}
            removeLabel="למחוק את הקטע"
            className={`${card} ${b.type === "heading" ? "border-s-4 !border-s-[color:var(--primary)]" : ""}`}
          >
            {(tools) => (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    aria-label="סוג הקטע"
                    value={b.type}
                    onChange={(e) => {
                      const type = e.target.value as PrepBlockType;
                      const toList = type === "bullets" || type === "numbered";
                      upd(bi, {
                        type,
                        items: toList && !isList ? (b.text ? b.text.split("\n") : [""]) : b.items,
                        text: !toList && isList ? b.items.join("\n") : b.text,
                      });
                    }}
                    className="rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-1 text-xs font-semibold"
                  >
                    {BLOCK_TYPES.map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {tools}
                </div>
                {!isList ? (
                  <TextField
                    label={b.type === "heading" ? "כותרת" : "טקסט"}
                    value={b.text}
                    minRows={b.type === "heading" ? 1 : 2}
                    onChange={(v) => upd(bi, { text: v })}
                    className={b.type === "heading" ? "font-display text-lg font-bold" : ""}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {b.items.map((it, ii) => (
                      <SortRow
                        key={`${b.id}-${ii}`}
                        list={`items:${b.id}`}
                        index={ii}
                        count={b.items.length}
                        onMove={(x, y) => upd(bi, { items: move(b.items, x, y) })}
                        onRemove={() => upd(bi, { items: b.items.filter((_, i) => i !== ii) })}
                        removeLabel="למחוק את הפריט"
                        className="rounded-lg"
                      >
                        {(itools) => (
                          <div className="flex items-start gap-2">
                            <span className="w-6 pt-1.5 text-center font-semibold">{b.type === "numbered" ? `${ii + 1}.` : "•"}</span>
                            <TextField
                              label={`פריט ${ii + 1}`}
                              value={it}
                              onChange={(v) => upd(bi, { items: b.items.map((x, i) => (i === ii ? v : x)) })}
                            />
                            {itools}
                          </div>
                        )}
                      </SortRow>
                    ))}
                    <AddButton onClick={() => upd(bi, { items: [...b.items, ""] })}>פריט</AddButton>
                  </div>
                )}
              </div>
            )}
          </SortRow>
        );
      })}
      <div className="flex flex-wrap gap-2">
        {BLOCK_TYPES.map((t) => (
          <AddButton key={t.type} onClick={() => add(t.type)}>
            {t.label}
          </AddButton>
        ))}
      </div>
    </div>
  );
}
