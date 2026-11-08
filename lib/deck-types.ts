// Teacher-only review presentations (issue #48). Client-safe types + helpers.

export interface DeckBullet {
  text: string;
  level: 0 | 1;
}

export interface DeckSlide {
  id: string;
  title: string;
  bullets: DeckBullet[];
  notes: string; // speaker notes: editor only, never shown in presenting / print
}

export const MAX_SLIDES = 200;
const MAX_TITLE = 300;
const MAX_BULLET = 1000;
const MAX_BULLETS = 60;
const MAX_NOTES = 5000;

export function newSlideId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

// Sanitises untrusted JSON (request body or DB column) into slides.
export function parseSlides(raw: unknown): DeckSlide[] {
  if (!Array.isArray(raw)) return [];
  const out: DeckSlide[] = [];
  const seen = new Set<string>();
  for (const s of raw.slice(0, MAX_SLIDES)) {
    if (!s || typeof s !== "object") continue;
    const o = s as Record<string, unknown>;
    let id = typeof o.id === "string" && o.id ? o.id.slice(0, 40) : newSlideId();
    if (seen.has(id)) id = newSlideId();
    seen.add(id);
    const bullets: DeckBullet[] = [];
    if (Array.isArray(o.bullets)) {
      for (const b of o.bullets.slice(0, MAX_BULLETS)) {
        if (!b || typeof b !== "object") continue;
        const bo = b as Record<string, unknown>;
        const text = String(bo.text ?? "").slice(0, MAX_BULLET);
        if (!text.trim()) continue;
        bullets.push({ text, level: bo.level === 1 ? 1 : 0 });
      }
    }
    out.push({
      id,
      title: String(o.title ?? "").slice(0, MAX_TITLE),
      bullets,
      notes: String(o.notes ?? "").slice(0, MAX_NOTES),
    });
  }
  return out;
}

// Bullets <-> the editor textarea: one line per bullet, a leading indent
// (spaces / tab) marks a sub-bullet.
export function bulletsToText(bullets: DeckBullet[]): string {
  return bullets.map((b) => (b.level === 1 ? "  " : "") + b.text).join("\n");
}

export function textToBullets(text: string): DeckBullet[] {
  const out: DeckBullet[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    const level = /^\s+/.test(line) ? 1 : 0;
    out.push({ text: line.trim().replace(/^-\s+/, ""), level });
  }
  return out;
}

// Parses the teacher's text format: a "שקופית N: title" line starts a slide,
// "- x" is a bullet, "  - x" a sub-bullet.
export function parseDeckText(text: string): DeckSlide[] {
  const slides: DeckSlide[] = [];
  let cur: DeckSlide | null = null;
  for (const line of text.split("\n")) {
    const head = line.match(/^שקופית\s+\d+:\s*(.*)$/);
    if (head) {
      cur = { id: newSlideId(), title: head[1].trim(), bullets: [], notes: "" };
      slides.push(cur);
      continue;
    }
    const sub = line.match(/^\s+-\s+(.*)$/);
    const top = line.match(/^-\s+(.*)$/);
    if (cur && sub) cur.bullets.push({ text: sub[1].trim(), level: 1 });
    else if (cur && top) cur.bullets.push({ text: top[1].trim(), level: 0 });
  }
  return slides;
}
