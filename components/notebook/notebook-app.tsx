"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  NOTEBOOK_TITLE_MAX,
  formatEntryDate,
  notebookText,
  sanitizeNotebookHtml,
  searchKey,
  type NotebookEntry,
  type NotebookUnit,
} from "@/lib/notebook-shared";

// "המחברת שלי" (issue #52): the list of dated entries (newest first), search
// and unit filter, the entry editor with autosave, and the print menu. Used
// as a full page, inside the task page's side panel (compact), and read-only
// for the teacher in the dashboard.

type Lang = "he" | "en";
type SaveState = "idle" | "pending" | "saving" | "saved" | "error";

export default function NotebookApp({
  initialEntries,
  initialUnits,
  lang = "he",
  compact = false,
  readOnly = false,
  defaultUnit = "",
  ownerId,
}: {
  initialEntries?: NotebookEntry[];
  initialUnits?: NotebookUnit[];
  lang?: Lang;
  compact?: boolean;
  readOnly?: boolean;
  defaultUnit?: string;
  ownerId?: number; // teacher view: whose notebook the print page shows
}) {
  const [entries, setEntries] = useState<NotebookEntry[] | null>(initialEntries ?? null);
  const [units, setUnits] = useState<NotebookUnit[]>(initialUnits ?? []);
  const [lng, setLng] = useState<Lang>(lang);
  const [loadError, setLoadError] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const flushRef = useRef<(() => Promise<boolean>) | null>(null);

  // the side panel loads its own data
  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/notebook", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries(data.entries);
      setUnits(data.units);
      setLng(data.lang === "en" ? "en" : "he");
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    if (initialEntries === undefined) void load();
  }, [initialEntries, load]);

  const unitLabel = useCallback(
    (key: string) => units.find((u) => u.key === key)?.label ?? "",
    [units]
  );

  async function openToday() {
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unitKey: defaultUnit }),
      });
      if (!res.ok) throw new Error();
      const { entry } = (await res.json()) as { entry: NotebookEntry };
      setEntries((cur) => (cur && cur.some((e) => e.id === entry.id) ? cur : [entry, ...(cur ?? [])]));
      setQuery("");
      setUnitFilter("");
      setOpenId(entry.id);
    } catch {
      setCreateError("לא הצלחנו לפתוח את הסיכום של היום — נסו שוב");
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => {
    const q = searchKey(query.trim());
    return (entries ?? []).filter((e) => {
      if (unitFilter && e.unitKey !== unitFilter) return false;
      if (!q) return true;
      const hay = searchKey(
        `${e.title}\n${notebookText(e.body)}\n${unitLabel(e.unitKey)}\n${formatEntryDate(e.entryDate, lng)}`
      );
      return hay.includes(q);
    });
  }, [entries, query, unitFilter, unitLabel, lng]);

  const open = entries?.find((e) => e.id === openId) ?? null;

  function patchLocal(id: number, patch: Partial<NotebookEntry>) {
    setEntries((cur) => cur?.map((e) => (e.id === id ? { ...e, ...patch } : e)) ?? cur);
  }

  async function closeEditor() {
    if (flushRef.current) await flushRef.current();
    setOpenId(null);
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6 text-center text-sm">
        <p className="text-[color:var(--danger)]">לא הצלחנו לטעון את המחברת.</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs font-bold text-[color:var(--primary)]"
        >
          ניסיון חוזר
        </button>
      </div>
    );
  }
  if (entries === null) {
    return <p className="p-6 text-center text-sm text-[color:var(--foreground)]/60">טוען את המחברת…</p>;
  }

  return (
    <div className="space-y-4">
      {open ? (
        <EntryEditor
          key={open.id}
          entry={open}
          units={units}
          lang={lng}
          readOnly={readOnly}
          onLocal={(patch) => patchLocal(open.id, patch)}
          onBack={closeEditor}
          onDeleted={() => {
            setEntries((cur) => cur?.filter((e) => e.id !== open.id) ?? cur);
            setOpenId(null);
          }}
          registerFlush={(fn) => {
            flushRef.current = fn;
          }}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={() => void openToday()}
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-full bg-[color:var(--accent-fill)] px-5 py-2 text-sm font-bold text-white shadow transition hover:scale-[1.02] disabled:cursor-wait disabled:opacity-70"
              >
                {creating && (
                  <span
                    aria-hidden
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                )}
                {creating ? "פותח…" : "✏️ סיכום של היום"}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPrintOpen((o) => !o)}
              aria-expanded={printOpen}
              className="rounded-full border border-[color:var(--border)] bg-[color:var(--card)] px-4 py-2 text-sm font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
            >
              📄 הדפסה / PDF
            </button>
          </div>
          {createError && <p className="text-xs font-semibold text-[color:var(--danger)]">{createError}</p>}

          {printOpen && (
            <PrintMenu
              units={units}
              ownerId={ownerId}
              flush={async () => {
                if (flushRef.current) await flushRef.current();
              }}
              onClose={() => setPrintOpen(false)}
            />
          )}

          <div className={`grid gap-2 ${compact ? "" : "sm:grid-cols-[1fr_auto]"}`}>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="🔍 חיפוש במחברת"
              aria-label="חיפוש במחברת"
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            />
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              aria-label="סינון לפי יחידה"
              className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2 text-sm text-[color:var(--foreground)]"
            >
              <option value="">כל היחידות</option>
              {units.map((u) => (
                <option key={u.key} value={u.key}>
                  {u.label}
                </option>
              ))}
            </select>
          </div>

          {entries.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-[color:var(--accent)]/40 bg-[color:var(--card)] p-6 text-center text-sm leading-6 text-[color:var(--foreground)]/70">
              {readOnly
                ? "התלמידה עוד לא כתבה במחברת."
                : "המחברת עוד ריקה. לוחצות על ״סיכום של היום״ וכותבות את הסיכום הראשון 📓"}
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-[color:var(--foreground)]/60">לא נמצאו רשומות מתאימות.</p>
          ) : (
            <ul className="space-y-3">
              {filtered.map((e) => {
                const snippet = notebookText(e.body);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setOpenId(e.id)}
                      className="block w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 text-start shadow-sm transition hover:border-[color:var(--accent)]"
                    >
                      <span className="block text-xs font-bold text-[color:var(--accent)]">
                        {formatEntryDate(e.entryDate, lng)}
                      </span>
                      <span className="mt-1 block font-display text-base font-bold text-[color:var(--primary)]">
                        {e.title || (lng === "en" ? "(no title)" : "(ללא כותרת)")}
                      </span>
                      {e.unitKey && unitLabel(e.unitKey) && (
                        <span className="mt-1 inline-block rounded-full bg-[color:var(--primary)]/10 px-2 py-0.5 text-[11px] font-semibold text-[color:var(--primary)]">
                          {unitLabel(e.unitKey)}
                        </span>
                      )}
                      {snippet && (
                        <span
                          dir="rtl"
                          className="mt-2 line-clamp-2 block whitespace-pre-line text-sm leading-6 text-[color:var(--foreground)]/70"
                        >
                          {snippet}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// ── Print menu ──────────────────────────────────────────────────────────
function PrintMenu({
  units,
  ownerId,
  flush,
  onClose,
}: {
  units: NotebookUnit[];
  ownerId?: number;
  flush: () => Promise<void>;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"all" | "filter">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [unit, setUnit] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    setBusy(true);
    const qs = new URLSearchParams();
    if (mode === "filter") {
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      if (unit) qs.set("unit", unit);
    }
    if (ownerId) qs.set("user", String(ownerId));
    const url = `/notebook/print${qs.toString() ? `?${qs}` : ""}`;
    // open the tab inside the click (phones block popups opened later), then
    // point it at the print page once every pending edit reached the server
    const tab = window.open("", "_blank");
    try {
      await flush();
      if (tab) {
        tab.opener = null;
        tab.location.href = url;
      } else {
        window.location.assign(url);
      }
    } finally {
      window.setTimeout(() => setBusy(false), 600);
    }
  }

  const radio = "flex items-center gap-2 text-sm text-[color:var(--foreground)]";
  const field =
    "rounded-lg border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1.5 text-sm text-[color:var(--foreground)]";
  return (
    <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm">
      <p className="mb-2 text-sm font-bold text-[color:var(--primary)]">מה להדפיס?</p>
      <div className="space-y-2">
        <label className={radio}>
          <input type="radio" name="nb-print" checked={mode === "all"} onChange={() => setMode("all")} />
          כל המחברת
        </label>
        <label className={radio}>
          <input type="radio" name="nb-print" checked={mode === "filter"} onChange={() => setMode("filter")} />
          טווח תאריכים או יחידה מסוימת
        </label>
        {mode === "filter" && (
          <div className="grid gap-2 ps-6 sm:grid-cols-2">
            <label className="text-xs text-[color:var(--foreground)]/70">
              מתאריך
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={`${field} mt-0.5 block w-full`} />
            </label>
            <label className="text-xs text-[color:var(--foreground)]/70">
              עד תאריך
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={`${field} mt-0.5 block w-full`} />
            </label>
            <label className="text-xs text-[color:var(--foreground)]/70 sm:col-span-2">
              יחידה
              <select value={unit} onChange={(e) => setUnit(e.target.value)} className={`${field} mt-0.5 block w-full`}>
                <option value="">כל היחידות</option>
                {units.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy}
          className="rounded-full bg-[color:var(--primary-fill)] px-5 py-2 text-sm font-bold text-white shadow disabled:opacity-70"
        >
          {busy ? "מכין את הדף…" : "פתיחת דף הדפסה"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[color:var(--border)] px-4 py-2 text-sm text-[color:var(--primary)]"
        >
          סגירה
        </button>
        <span className="text-xs text-[color:var(--foreground)]/60">בדף שנפתח בוחרים ״הדפסה״ או ״שמירה כ־PDF״</span>
      </div>
    </div>
  );
}

// ── The entry editor ────────────────────────────────────────────────────
interface Patch {
  title?: string;
  unitKey?: string;
  body?: string;
}

function EntryEditor({
  entry,
  units,
  lang,
  readOnly,
  onLocal,
  onBack,
  onDeleted,
  registerFlush,
}: {
  entry: NotebookEntry;
  units: NotebookUnit[];
  lang: Lang;
  readOnly: boolean;
  onLocal: (patch: Partial<NotebookEntry>) => void;
  onBack: () => Promise<void>;
  onDeleted: () => void;
  registerFlush: (fn: (() => Promise<boolean>) | null) => void;
}) {
  const [title, setTitle] = useState(entry.title);
  const [unitKey, setUnitKey] = useState(entry.unitKey);
  const [state, setState] = useState<SaveState>("idle");
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const dirty = useRef<Patch>({});
  const chain = useRef<Promise<boolean>>(Promise.resolve(true));
  const timer = useRef<number | null>(null);
  const retry = useRef<number | null>(null);
  const alive = useRef(true);
  const id = entry.id;

  const send = useCallback(async (): Promise<boolean> => {
    const patch = dirty.current;
    if (Object.keys(patch).length === 0) return true;
    dirty.current = {};
    if (alive.current) setState("saving");
    try {
      const res = await fetch(`/api/notebook/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      if (alive.current) setState(Object.keys(dirty.current).length > 0 ? "pending" : "saved");
      return true;
    } catch {
      // keep the unsaved text; newer edits win over the failed ones
      dirty.current = { ...patch, ...dirty.current };
      if (alive.current) {
        setState("error");
        if (retry.current) window.clearTimeout(retry.current);
        retry.current = window.setTimeout(() => void flush(), 5000);
      }
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // serialized: one request at a time, in order
  const flush = useCallback((): Promise<boolean> => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    chain.current = chain.current.then(send);
    return chain.current;
  }, [send]);

  const schedule = useCallback(
    (patch: Patch) => {
      dirty.current = { ...dirty.current, ...patch };
      setState("pending");
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), 800);
    },
    [flush]
  );

  useEffect(() => {
    registerFlush(readOnly ? null : flush);
    return () => registerFlush(null);
  }, [flush, readOnly, registerFlush]);

  // fill the editor once (it is uncontrolled while typing)
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = sanitizeNotebookHtml(entry.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // never lose text: save on leaving the tab / closing the editor
  useEffect(() => {
    alive.current = true;
    const hide = () => {
      if (document.visibilityState === "hidden" && Object.keys(dirty.current).length > 0) void flush();
    };
    const warn = (e: BeforeUnloadEvent) => {
      if (Object.keys(dirty.current).length > 0) {
        e.preventDefault();
        void flush();
      }
    };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener("beforeunload", warn);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", hide);
      window.removeEventListener("beforeunload", warn);
      if (timer.current) window.clearTimeout(timer.current);
      if (retry.current) window.clearTimeout(retry.current);
      if (Object.keys(dirty.current).length > 0) {
        const patch = dirty.current;
        dirty.current = {};
        void fetch(`/api/notebook/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
          keepalive: true,
        }).catch(() => {});
      }
    };
  }, [flush, id]);

  function onBodyInput() {
    const el = editorRef.current;
    if (!el) return;
    // an emptied editor keeps a stray <br>; treat it as empty
    if (el.textContent?.trim() === "" && !el.querySelector("li")) el.innerHTML = "";
    const html = el.innerHTML;
    onLocal({ body: html });
    schedule({ body: html });
  }

  function format(cmd: "bold" | "insertOrderedList" | "insertUnorderedList") {
    editorRef.current?.focus();
    document.execCommand(cmd);
    onBodyInput();
  }

  // paste as plain text: nikud and verses stay exactly as copied, foreign
  // styling from Word / websites never comes along
  function onPaste(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, html);
  }

  async function remove() {
    if (!window.confirm("למחוק את הרשומה מהמחברת? אי אפשר לשחזר אותה.")) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (timer.current) window.clearTimeout(timer.current);
      dirty.current = {};
      await chain.current;
      const res = await fetch(`/api/notebook/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      setDeleteError("המחיקה נכשלה — נסו שוב");
      setDeleting(false);
    }
  }

  const tb =
    "rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5 text-sm font-bold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]";

  const status =
    state === "pending" ? (
      <span className="text-[color:var(--warning)]">● ממתין לשמירה…</span>
    ) : state === "saving" ? (
      <span className="text-[color:var(--primary)]/70">שומר…</span>
    ) : state === "saved" ? (
      <span className="font-semibold text-[color:var(--success)]">נשמר ✓</span>
    ) : state === "error" ? (
      <span className="font-semibold text-[color:var(--danger)]">
        לא נשמר — ננסה שוב.{" "}
        <button type="button" onClick={() => void flush()} className="underline">
          שמירה עכשיו
        </button>
      </span>
    ) : null;

  return (
    <article className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-4 shadow-sm sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          disabled={leaving}
          onClick={async () => {
            setLeaving(true);
            await onBack();
            setLeaving(false);
          }}
          className="rounded-full border border-[color:var(--border)] px-4 py-1.5 text-xs font-bold text-[color:var(--primary)] disabled:opacity-60"
        >
          {leaving ? "שומר…" : "→ חזרה לרשימה"}
        </button>
        {!readOnly && (
          <span className="text-xs" aria-live="polite">
            {status}
          </span>
        )}
      </div>

      <p className="text-sm font-bold text-[color:var(--accent)]">{formatEntryDate(entry.entryDate, lang)}</p>

      {readOnly ? (
        <>
          <h2 className="mt-2 font-display text-xl font-extrabold text-[color:var(--primary)]">
            {entry.title || (lang === "en" ? "(no title)" : "(ללא כותרת)")}
          </h2>
          {entry.unitKey && (
            <p className="mt-1 text-xs font-semibold text-[color:var(--primary)]/70">
              {units.find((u) => u.key === entry.unitKey)?.label ?? ""}
            </p>
          )}
          <div
            dir="rtl"
            className="notebook-body mt-4 text-[15px] leading-7 text-[color:var(--foreground)]"
            dangerouslySetInnerHTML={{ __html: sanitizeNotebookHtml(entry.body) }}
          />
        </>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-[color:var(--foreground)]/70">
              כותרת או נושא (לא חובה)
              <input
                type="text"
                value={title}
                maxLength={NOTEBOOK_TITLE_MAX}
                placeholder="למשל: קרח ועדתו"
                onChange={(e) => {
                  setTitle(e.target.value);
                  onLocal({ title: e.target.value });
                  schedule({ title: e.target.value });
                }}
                className="mt-1 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm font-normal text-[color:var(--foreground)]"
              />
            </label>
            <label className="text-xs font-semibold text-[color:var(--foreground)]/70">
              יחידה (לא חובה)
              <select
                value={unitKey}
                onChange={(e) => {
                  setUnitKey(e.target.value);
                  onLocal({ unitKey: e.target.value });
                  schedule({ unitKey: e.target.value });
                }}
                className="mt-1 block w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm font-normal text-[color:var(--foreground)]"
              >
                <option value="">ללא יחידה</option>
                {units.map((u) => (
                  <option key={u.key} value={u.key}>
                    {u.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2" role="toolbar" aria-label="עיצוב">
            <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => format("bold")} title="מודגש (Ctrl+B)">
              <b>B</b> מודגש
            </button>
            <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => format("insertOrderedList")}>
              1. רשימה ממוספרת
            </button>
            <button type="button" className={tb} onMouseDown={(e) => e.preventDefault()} onClick={() => format("insertUnorderedList")}>
              • תבליטים
            </button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            dir="rtl"
            role="textbox"
            aria-multiline
            aria-label="הסיכום"
            data-placeholder="כותבות כאן את הסיכום…"
            onInput={onBodyInput}
            onPaste={onPaste}
            onBlur={() => {
              if (Object.keys(dirty.current).length > 0) void flush();
            }}
            className="notebook-body notebook-editor mt-3 min-h-[16rem] rounded-xl border border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 text-[15px] leading-7 text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent)]"
          />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => void remove()}
              disabled={deleting}
              className="rounded-full border border-[color:var(--danger)]/50 px-4 py-1.5 text-xs font-bold text-[color:var(--danger)] transition hover:bg-[color:var(--danger)]/10 disabled:opacity-60"
            >
              {deleting ? "מוחק…" : "🗑 מחיקת הרשומה"}
            </button>
            {deleteError && <span className="text-xs font-semibold text-[color:var(--danger)]">{deleteError}</span>}
          </div>
        </>
      )}
    </article>
  );
}
