"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionRow, ChatMessageRow, CodeRequestRow } from "@/lib/teacher-chat";
import { CHAT_EXAMPLES } from "@/lib/teacher-chat-examples";

// The teacher's chat. One column: messages, and under an assistant message
// the cards it produced — "זה מה שאשנה" with before/after and a ✓, or a code
// request with its live status. Everything she taps shows its state.

type Msg = { id: number | string; role: "user" | "assistant"; text: string; createdAt: number };

function flatten(rows: ChatMessageRow[]): Msg[] {
  const out: Msg[] = [];
  for (const r of rows) {
    const blocks = Array.isArray(r.content) ? r.content : [{ type: "text", text: String(r.content) }];
    const text = (blocks as { type: string; text?: string }[])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => (b.text ?? "").replace(/^\[[^\]]*\]\n/, ""))
      .join("\n")
      .trim();
    if (!text) continue; // tool_use / tool_result turns are not shown
    out.push({ id: r.id, role: r.role, text, createdAt: r.createdAt });
  }
  return out;
}

const STATUS_HE: Record<string, { label: string; tone: string }> = {
  queued: { label: "ממתין לחיבור ל-GitHub", tone: "var(--warning)" },
  open: { label: "נשלח — קלוד מתחיל", tone: "var(--accent)" },
  working: { label: "קלוד עובד על זה", tone: "var(--accent)" },
  preview: { label: "נבנה — ממתין למיזוג אוטומטי", tone: "var(--primary)" },
  merged: { label: "עלה לאתר ✓", tone: "var(--success)" },
  failed: { label: "הבנייה נכשלה — רפאל קיבל הודעה", tone: "var(--danger)" },
  closed: { label: "נסגר", tone: "var(--primary)" },
};

export default function TeacherChat({ teacherName, compact = false }: { teacherName: string | null; compact?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [threads, setThreads] = useState<{ thread: number; title: string; startedAt: number; count: number }[]>([]);
  const [thread, setThread] = useState<number | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [codeRequests, setCodeRequests] = useState<CodeRequestRow[]>([]);
  const [github, setGithub] = useState(true);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  const load = async (t?: number | null) => {
    const r = await fetch(`/api/teacher-chat${t ? `?thread=${t}` : ""}`, { cache: "no-store" });
    const d = await r.json();
    if (!d.ok) return;
    setMsgs(flatten(d.messages));
    setActions(d.actions);
    setCodeRequests(d.codeRequests);
    setGithub(Boolean(d.github));
    setThreads(d.threads ?? []);
    setThread(d.thread ?? null);
    setLoaded(true);
  };
  const isLatest = thread == null || threads.length === 0 || thread === Math.max(...threads.map((t) => t.thread));
  useEffect(() => {
    void load();
    const iv = setInterval(() => {
      // code-request statuses move on their own — keep the cards live
      fetch("/api/teacher-chat", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.ok) setCodeRequests(d.codeRequests);
        })
        .catch(() => {});
    }, 60000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, actions.length, busy]);

  const send = async () => {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    setDraft("");
    const tempId = `tmp-${Date.now()}`;
    setMsgs((m) => [...m, { id: tempId, role: "user", text, createdAt: Date.now() / 1000 }]);
    try {
      const r = await fetch("/api/teacher-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? "משהו השתבש");
      setMsgs(flatten(d.messages));
      if (d.newActions?.length) setActions((a) => [...a, ...d.newActions]);
      const cr = await fetch("/api/teacher-chat", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
      if (cr?.ok) {
        setActions(cr.actions);
        setCodeRequests(cr.codeRequests);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "משהו השתבש");
      setDraft(text);
      setMsgs((m) => m.filter((x) => x.id !== tempId));
    } finally {
      setBusy(false);
      taRef.current?.focus();
    }
  };

  const act = async (id: number, what: "apply" | "dismiss" | "undo") => {
    setActions((as) => as.map((a) => (a.id === id ? { ...a, status: what === "apply" ? "applying" : what === "undo" ? "undoing" : "dismissed" } : a)));
    try {
      const r = await fetch("/api/teacher-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: id, do: what }) });
      const d = await r.json();
      if (!d.ok) throw new Error(d.error ?? "לא הצליח");
      if (d.action) setActions((as) => as.map((a) => (a.id === id ? d.action : a)));
      if (what === "apply") {
        const cr = await fetch("/api/teacher-chat", { cache: "no-store" }).then((x) => x.json()).catch(() => null);
        if (cr?.ok) setCodeRequests(cr.codeRequests);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצליח");
      void load();
    }
  };

  const restart = async () => {
    if (!window.confirm("להתחיל שיחה חדשה? השיחה הנוכחית נשמרת בארכיון.")) return;
    await fetch("/api/teacher-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ newThread: true }) });
    await load();
  };

  // cards are shown right after the assistant message they belong to: we
  // place each action under the last assistant message created before it
  // (tool calls happen between her message and the reply, so a card belongs
  // to the first visible assistant message written after it)
  const cardsAfter = (m: Msg, i: number) => {
    if (m.role !== "assistant") return [];
    const prev = msgs[i - 1];
    const last = i === msgs.length - 1;
    return actions.filter((a) => (!prev || a.createdAt >= prev.createdAt) && (last || a.createdAt <= m.createdAt + 1));
  };
  const codeFor = (a: ActionRow) => (a.tool === "request_code_change" && a.result && typeof a.result === "object" ? codeRequests.find((c) => c.id === (a.result as { codeRequestId?: number }).codeRequestId) ?? null : null);

  return (
    <div className={`flex flex-col ${compact ? "min-h-full" : "min-h-[70vh]"}`} dir="rtl">
      <div className={`flex flex-wrap items-center justify-between gap-2 text-xs text-[color:var(--primary)]/60 ${compact ? "mb-2" : "mb-3"}`}>
        {!compact && (
          <p>
            כותבים כאן מה לשנות, לעדכן, לבדוק או לשפר — ביחידות, במשימות, בתלמידים, או באתר עצמו — וזה קורה. שינוי באתר עצמו נבנה ועולה לבד תוך דקות.
          </p>
        )}
        <span className="flex items-center gap-2">
          {threads.length > 1 && (
            <select
              value={thread ?? ""}
              onChange={(e) => void load(Number(e.target.value))}
              className="rounded-full border border-[color:var(--border)] bg-white px-2 py-1 text-[11px] font-bold text-[color:var(--primary)]"
              aria-label="שיחות קודמות"
            >
              {threads.map((t) => (
                <option key={t.thread} value={t.thread}>
                  {new Date(t.startedAt * 1000).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })} · {t.title.slice(0, 28)}
                </option>
              ))}
            </select>
          )}
          <button type="button" onClick={restart} className="rounded-full border border-[color:var(--border)] px-3 py-1 font-bold hover:border-[color:var(--accent)]">
            שיחה חדשה
          </button>
        </span>
      </div>
      {!isLatest && (
        <p className="mb-2 rounded-xl bg-[color:var(--background)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--primary)]/60">
          שיחה קודמת (לקריאה). כדי להמשיך לכתוב —{" "}
          <button type="button" onClick={() => void load(null)} className="underline">
            חזרה לשיחה הנוכחית
          </button>
        </p>
      )}
      {!github && codeRequests.some((c) => c.status === "queued") && (
        <p className="mb-3 rounded-xl border border-[color:var(--warning)]/50 bg-[color:var(--warning)]/10 px-3 py-2 text-xs text-[color:var(--warning)]">
          בקשות לשינוי באתר ממתינות: החיבור ל-GitHub עוד לא הוגדר (משתנה GITHUB_TOKEN). הן יישלחו אוטומטית כשיוגדר.
        </p>
      )}

      <div className={`flex-1 space-y-3 rounded-3xl border border-[color:var(--border)] bg-[color:var(--card)] ${compact ? "p-3" : "p-4 sm:p-5"}`}>
        {!loaded && <p className="text-center text-sm text-[color:var(--primary)]/50">טוען…</p>}
        {loaded && msgs.length === 0 && (
          <div className="rounded-2xl bg-[color:var(--background)] px-4 py-4 text-sm leading-7 text-[color:var(--foreground)]/80">
            <p className="font-bold text-[color:var(--primary)]">שלום{teacherName ? ` ${teacherName.split(" ")[0]}` : ""} 👋</p>
            <p>אפשר לכתוב למשל:</p>
            <ul className="list-disc space-y-0.5 pe-5">
              {CHAT_EXAMPLES.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={m.id}>
            <div className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[15px] leading-7 shadow-sm ${m.role === "user" ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--background)] text-[color:var(--foreground)]"}`}
              >
                {m.text}
              </div>
            </div>
            {cardsAfter(m, i).map((a) => (
              <ActionCard key={a.id} a={a} code={codeFor(a)} onAct={act} />
            ))}
          </div>
        ))}
        {busy && (
          <div className="flex justify-end">
            <div className="rounded-2xl bg-[color:var(--background)] px-4 py-2.5 text-sm text-[color:var(--primary)]/60">
              <span className="animate-pulse">קלוד עובד על זה…</span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-2 text-xs font-bold text-[color:var(--danger)]">{error}</p>}
      <div className={`sticky bottom-0 mt-3 flex items-end gap-2 py-2 ${compact ? "" : "bg-[color:var(--background)]"}`} style={compact ? { background: "color-mix(in srgb, var(--card) 96%, transparent)" } : undefined}>
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          placeholder="מה לשנות או לבדוק? (Enter שולח, Shift+Enter שורה חדשה)"
          className="flex-1 rounded-2xl border border-[color:var(--border)] bg-white px-4 py-3 text-[15px] leading-6 outline-none focus:border-[color:var(--accent)]"
        />
        <button
          type="button"
          onClick={send}
          disabled={busy || !draft.trim()}
          className={`rounded-full px-5 py-3 text-sm font-extrabold text-white shadow transition active:scale-95 disabled:opacity-40 ${busy ? "animate-pulse" : ""}`}
          style={{ background: "var(--accent)" }}
        >
          {busy ? "…" : "שליחה"}
        </button>
      </div>
    </div>
  );
}

function ActionCard({ a, code, onAct }: { a: ActionRow; code: CodeRequestRow | null; onAct: (id: number, what: "apply" | "dismiss" | "undo") => void }) {
  // a thin receipt under the reply — what ran, and a way back. No buttons to
  // approve: the chat is a chat, the change already happened.
  const working = a.status === "undoing";
  const isCode = a.tool === "request_code_change";
  const st = code ? STATUS_HE[code.status] ?? { label: code.status, tone: "var(--primary)" } : null;
  const tone = a.status === "applied" ? "var(--success)" : a.status === "failed" ? "var(--danger)" : "var(--primary)";
  return (
    <div className="my-1 me-0 ms-auto flex max-w-[92%] flex-wrap items-center gap-x-2 gap-y-1 rounded-xl px-3 py-1.5 text-[12px]" style={{ background: "color-mix(in srgb, var(--background) 70%, transparent)" }}>
      <span className="font-bold" style={{ color: tone }}>
        {a.status === "applied" ? (isCode ? "🛠️ נשלח לבנייה" : "✓") : a.status === "undone" ? "↶ בוטל" : a.status === "failed" ? "✗ לא הצליח" : working ? "…" : "·"}
      </span>
      <span className="text-[color:var(--foreground)]/80">{a.summary}</span>
      {a.status === "failed" && a.result != null && typeof a.result === "object" && "error" in (a.result as object) ? (
        <span className="text-[color:var(--danger)]">{String((a.result as { error: string }).error)}</span>
      ) : null}
      {code && st && (
        <>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: st.tone }}>
            {st.label}
          </span>
          {code.issueUrl && (
            <a href={code.issueUrl} target="_blank" rel="noopener noreferrer" className="underline text-[color:var(--primary)]/70">
              מעקב ↗
            </a>
          )}
          {code.previewUrl && code.status === "preview" && (
            <a href={code.previewUrl} target="_blank" rel="noopener noreferrer" className="underline text-[color:var(--primary)]/70">
              תצוגה מקדימה ↗
            </a>
          )}
        </>
      )}
      {a.status === "applied" && a.undoable && (
        <button type="button" onClick={() => onAct(a.id, "undo")} className="text-[11px] font-bold text-[color:var(--primary)]/60 underline hover:text-[color:var(--accent)]">
          לבטל
        </button>
      )}
      {working && <span className="animate-pulse text-[color:var(--primary)]/60">משחזרים…</span>}
    </div>
  );
}
