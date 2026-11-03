"use client";

import AutoTextarea from "./auto-textarea";
import SortableItem, { moveItem } from "./sortable";
import { type PrepBlock, type PrepDoc, isListBlock, newId } from "@/lib/exams-types";

const TYPE_LABEL: Record<PrepBlock["type"], string> = {
  h: "כותרת",
  p: "טקסט חופשי",
  ul: "רשימה עם נקודות",
  ol: "רשימה ממוספרת",
};

const addBtn =
  "rounded-full border border-[color:var(--border)] bg-[color:var(--field)] px-3 py-1.5 text-xs font-bold text-[color:var(--primary)] hover:border-[color:var(--accent)]";

export default function PrepDocEditor({
  doc,
  onChange,
}: {
  doc: PrepDoc;
  onChange: (d: PrepDoc) => void;
}) {
  const setBlocks = (blocks: PrepBlock[]) => onChange({ blocks });
  const patch = (i: number, b: PrepBlock) => setBlocks(doc.blocks.map((x, k) => (k === i ? b : x)));
  const add = (type: PrepBlock["type"]) =>
    setBlocks([
      ...doc.blocks,
      type === "ul" || type === "ol"
        ? { id: newId(), type, items: [""] }
        : { id: newId(), type, text: "" },
    ]);

  return (
    <div className="space-y-3">
      {doc.blocks.length === 0 && (
        <p className="rounded-xl border border-dashed border-[color:var(--border)] p-6 text-center text-sm text-[color:var(--foreground)]/60">
          הדף ריק. מוסיפים כותרת, טקסט או רשימה:
        </p>
      )}
      {doc.blocks.map((b, i) => (
        <SortableItem
          key={b.id}
          group="blocks"
          index={i}
          count={doc.blocks.length}
          onMove={(from, to) => setBlocks(moveItem(doc.blocks, from, to))}
          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3"
        >
          {(controls) => (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                {controls}
                <span className="text-xs font-extrabold text-[color:var(--accent)]">
                  {TYPE_LABEL[b.type]}
                </span>
                <select
                  aria-label="סוג הבלוק"
                  value={b.type}
                  onChange={(e) => {
                    const type = e.target.value as PrepBlock["type"];
                    const asText = isListBlock(b) ? b.items.join("\n") : b.text;
                    patch(
                      i,
                      type === "ul" || type === "ol"
                        ? { id: b.id, type, items: asText.split("\n") }
                        : { id: b.id, type, text: asText }
                    );
                  }}
                  className="rounded-md border border-[color:var(--border)] bg-[color:var(--field)] px-2 py-1 text-xs"
                >
                  {(Object.keys(TYPE_LABEL) as PrepBlock["type"][]).map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ms-auto rounded-full border border-[color:var(--danger)]/40 px-3 py-1 text-xs font-bold text-[color:var(--danger)] hover:bg-[color:var(--danger)]/10"
                  onClick={() => setBlocks(doc.blocks.filter((_, k) => k !== i))}
                >
                  מחיקה
                </button>
              </div>

              {isListBlock(b) ? (
                <>
                  <AutoTextarea
                    value={b.items.join("\n")}
                    onChange={(v) => patch(i, { ...b, items: v.split("\n") })}
                    minRows={3}
                    ariaLabel="פריטי הרשימה"
                    placeholder="כל שורה היא פריט ברשימה"
                  />
                  <p className="text-xs text-[color:var(--foreground)]/55">כל שורה היא פריט ברשימה.</p>
                </>
              ) : (
                <AutoTextarea
                  value={b.text}
                  onChange={(v) => patch(i, { ...b, text: v })}
                  minRows={b.type === "h" ? 1 : 3}
                  ariaLabel={TYPE_LABEL[b.type]}
                  placeholder={b.type === "h" ? "כותרת" : "טקסט חופשי"}
                  className={b.type === "h" ? "font-display text-lg font-bold" : ""}
                />
              )}
            </div>
          )}
        </SortableItem>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className={addBtn} onClick={() => add("h")}>
          + כותרת
        </button>
        <button type="button" className={addBtn} onClick={() => add("p")}>
          + טקסט חופשי
        </button>
        <button type="button" className={addBtn} onClick={() => add("ul")}>
          + רשימה עם נקודות
        </button>
        <button type="button" className={addBtn} onClick={() => add("ol")}>
          + רשימה ממוספרת
        </button>
      </div>
    </div>
  );
}
