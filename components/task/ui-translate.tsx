"use client";

import { useEffect } from "react";

// The English-language student's task page: the content arrives already
// translated from the server; this layer swaps the page's own Hebrew
// interface strings (buttons, labels, messages — lib/task-ui-strings.ts) for
// their English, and keeps doing so as the page changes. It never touches the
// Bible, the commentators (data-copy-free) or what the student types.
const ATTRS = ["placeholder", "title", "aria-label"] as const;
const HEB = /[֐-׿]/;

export default function UiTranslate({ dict, rootSelector = '[data-lang="en"]' }: { dict: Record<string, string>; rootSelector?: string }) {
  useEffect(() => {
    const roots = Array.from(document.querySelectorAll<HTMLElement>(rootSelector));
    if (!roots.length) return;
    // the Bible and the commentators are left alone — but buttons and links
    // inside their boxes ("help with this source") are interface
    const skip = (el: Element | null) =>
      !el ||
      Boolean(el.closest('textarea, input, [contenteditable="true"], [data-no-translate]')) ||
      (Boolean(el.closest('[data-copy-free="true"]')) && !el.closest("button, a, label, summary"));
    const lookup = (t: string): string | null => {
      if (dict[t]) return dict[t];
      // numbers inside: "שאלה 2 מתוך 23" → the template "שאלה {} מתוך {}"
      const nums = t.match(/\d+/g);
      if (nums) {
        const tpl = dict[t.replace(/\d+/g, "{}")];
        if (tpl) {
          let i = 0;
          return tpl.replace(/\{\}/g, () => nums[i++] ?? "");
        }
      }
      // decoration around the words: "✓ 2 · מילה מנחה" → translate the words
      const m = t.match(/^([^֐-׿]*?)([֐-׿][\s\S]*[֐-׿״׳"'?!.)]?)([^֐-׿]*)$/);
      if (m && m[2] !== t) {
        const core = dict[m[2].trim()];
        if (core) return `${m[1]}${core}${m[3]}`;
      }
      return null;
    };
    const swap = (s: string): string | null => {
      if (!HEB.test(s)) return null;
      const t = s.replace(/\s+/g, " ").trim();
      const en = lookup(t);
      if (!en) return null;
      const lead = s.match(/^\s*/)?.[0] ?? "";
      const tail = s.match(/\s*$/)?.[0] ?? "";
      // the page now reads left to right: "next ←" becomes "next →"
      const flipped = en.replace(/[←→]/g, (c) => (c === "←" ? "→" : "←"));
      return `${lead}${flipped}${tail}`;
    };
    const fixText = (n: Text) => {
      if (skip(n.parentElement)) return;
      const v = n.nodeValue ?? "";
      const out = swap(v);
      if (out !== null && out !== v) n.nodeValue = out;
    };
    const fixEl = (el: Element) => {
      if (skip(el) && !(el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement)) return;
      for (const a of ATTRS) {
        const v = el.getAttribute(a);
        if (!v) continue;
        const out = swap(v);
        if (out !== null && out !== v) el.setAttribute(a, out);
      }
    };
    const sweep = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) return fixText(node as Text);
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      fixEl(el);
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
      let cur: Node | null = walker.nextNode();
      while (cur) {
        if (cur.nodeType === Node.TEXT_NODE) fixText(cur as Text);
        else fixEl(cur as Element);
        cur = walker.nextNode();
      }
    };
    roots.forEach(sweep);
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "characterData") fixText(r.target as Text);
        else if (r.type === "attributes") fixEl(r.target as Element);
        else r.addedNodes.forEach(sweep);
      }
    });
    roots.forEach((root) => obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS] }));
    // toasts and menus render at the end of <body>; translate those too
    const bodyObs = new MutationObserver((records) => {
      for (const r of records) r.addedNodes.forEach((n) => {
        if (n instanceof Element && !roots.some((root) => root.contains(n)) && n.closest("body") && (n.getAttribute("role") === "status" || n.closest('[role="dialog"], [role="menu"]'))) sweep(n);
      });
    });
    bodyObs.observe(document.body, { childList: true });
    return () => {
      obs.disconnect();
      bodyObs.disconnect();
    };
  }, [dict, rootSelector]);
  return null;
}
