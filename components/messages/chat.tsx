"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The קשר chat: right pane = thread list (group + people), left pane = the
// conversation. Polls every 3s. Students see the teachers + the class group;
// the teacher sees the group + every student.

export interface Contact {
  id: number | "group";
  name: string;
  role: "teacher" | "student" | "group";
  unread: number;
}

interface ChatMessage {
  id: number;
  fromUserId: number;
  fromName?: string | null;
  fromRole?: string;
  body: string;
  sentAt: number;
}

export default function Chat({
  contacts: initialContacts,
  meId,
  meName,
}: {
  contacts: Contact[];
  meId: number;
  meName: string;
}) {
  const [contacts] = useState(initialContacts);
  const [active, setActive] = useState<Contact | null>(
    initialContacts[0] ?? null
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const load = useCallback(async () => {
    if (!active) return;
    try {
      const qs = active.id === "group" ? "group=1" : `with=${active.id}`;
      const res = await fetch(`/api/messages?${qs}`, { cache: "no-store" });
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch {
      // keep last
    }
  }, [active]);

  useEffect(() => {
    firstLoad.current = true;
    setMessages([]);
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, [load]);

  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView({
        behavior: firstLoad.current ? "instant" : "smooth",
      });
      firstLoad.current = false;
    }
  }, [messages.length]);

  const send = async () => {
    if (!active || !draft.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          active.id === "group"
            ? { group: true, body: draft }
            : { toUserId: active.id, body: draft }
        ),
      });
      setDraft("");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-[60vh] grid-cols-1 overflow-hidden rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] sm:grid-cols-[240px_1fr]">
      {/* contacts */}
      <aside className="border-b border-[color:var(--border)] sm:border-b-0 sm:border-s">
        <ul className="flex gap-1 overflow-x-auto p-2 sm:block sm:space-y-1">
          {contacts.map((c) => (
            <li key={String(c.id)}>
              <button
                onClick={() => setActive(c)}
                className={[
                  "flex w-full items-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-start text-sm transition",
                  active?.id === c.id
                    ? "bg-[color:var(--primary)] text-white"
                    : "hover:bg-[color:var(--primary)]/5",
                ].join(" ")}
              >
                <span className="text-lg">
                  {c.role === "group" ? "👥" : c.role === "teacher" ? "👩‍🏫" : "👩‍🎓"}
                </span>
                <span className="flex-1 font-semibold">{c.name}</span>
                {c.unread > 0 && (
                  <span className="rounded-full bg-[color:var(--danger)] px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* conversation */}
      <div className="flex flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto p-4" style={{ maxHeight: "55vh" }}>
          {messages.length === 0 ? (
            <p className="py-10 text-center text-xs text-[color:var(--primary)]/45">
              {active?.id === "group"
                ? "עוד אין הודעות בקבוצה — פתחו את השיחה! 💬"
                : "תחילת השיחה — כתבו הודעה ראשונה 💬"}
            </p>
          ) : (
            messages.map((m) => {
              const mine = m.fromUserId === meId;
              return (
                <div key={m.id} className={mine ? "flex justify-start flex-row-reverse" : "flex"}>
                  <div
                    className={[
                      "max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-6 shadow-sm",
                      mine
                        ? "rounded-tl-md bg-[color:var(--primary)] text-white"
                        : "rounded-tr-md bg-[color:var(--background)] text-[color:var(--foreground)]",
                    ].join(" ")}
                  >
                    {active?.id === "group" && !mine && (
                      <p className="mb-0.5 text-[10px] font-bold text-[color:var(--accent)]">
                        {m.fromName ?? ""}
                        {m.fromRole === "teacher" && " · מורה"}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className={["mt-0.5 text-[9px]", mine ? "text-white/60" : "text-[color:var(--primary)]/40"].join(" ")}>
                      {new Intl.DateTimeFormat("he-IL", {
                        day: "numeric",
                        month: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(m.sentAt * 1000))}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
        <div className="flex items-end gap-2 border-t border-[color:var(--border)] p-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a new line.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            rows={Math.min(5, Math.max(1, draft.split("\n").length))}
            placeholder={`הודעה ${active?.id === "group" ? "לקבוצה" : `ל${active?.name ?? ""}`}...`}
            className="flex-1 resize-none rounded-2xl border border-[color:var(--border)] bg-white px-4 py-2.5 text-sm leading-6 outline-none focus:border-[color:var(--accent)]"
          />
          <button
            onClick={send}
            disabled={busy || !draft.trim()}
            aria-label="שליחה"
            className="rounded-full bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            שליחה ↖
          </button>
        </div>
      </div>
    </div>
  );
}
