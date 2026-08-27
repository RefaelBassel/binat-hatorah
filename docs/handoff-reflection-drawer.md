# מגירת הרפלקציה — מסמך העברה מלא לאתרי למידה אחרים

> **מסמך זה מיועד ל־Claude Code בפרויקט אחר.** הוא מכיל את כל מה שנדרש כדי לבנות את
> מערכת הרפלקציה במלואה — קונספט, פדגוגיה, סכמת DB, ‏API, קוד רכיבים מלא, נקודות
> עיגון ולקחי UX — בלי שרפאל יצטרך להסביר דבר.
>
> **המקור:** האתר "בינת התורה" (binat-hatorah, Next.js 16 + Turso + Tailwind v4),
> שבו המערכת בנויה, פועלת ומאושרת. הקוד כאן הועתק אחד-לאחד מהמימוש החי.

---

## ‼️ פרוטוקול חובה לפני כתיבת שורת קוד אחת

אסור ליישם את המסמך הזה כמות שהוא. המערכת נבנתה עבור אתר ספציפי, עם פלטה ספציפית
ושתי מיומנויות-ליבה ספציפיות. לפני יישום, בצע את ארבעת השלבים הבאים **והמתן לאישור
רפאל**:

### שלב 1 — למד את האתר הנוכחי
קרא את ה־CLAUDE.md, את קובצי העיצוב (globals.css / tailwind config) ואת דפי התוכן
המרכזיים, וברר:
- מהי פלטת הצבעים ומהם שמות משתני ה־CSS (`--primary`, `--accent` וכו' — ייתכן
  ששמות אחרים).
- מה הסטאק: אם אינו Next.js App Router + Turso raw SQL + next-auth — סמן לעצמך מה
  יידרש לתרגם (ראה נספח א').
- **מהן מיומנויות-הליבה שהאתר מלמד** — זה הלב הפדגוגי: שני סרגלי ה"התקדמות" במגירה
  מודדים את שתי המיומנויות של האתר, לא ערכים גנריים.
- מהי לשון הפנייה של האתר: נקבה ("תוכלי"), זכר, או לשון מעורבת/ניטרלית. כל טקסט
  במגירה חייב להתיישר לזה.

### שלב 2 — הצע התאמת פלטה
הצג לרפאל טבלה קצרה: כל צבע שמופיע בקוד שלמטה → הצבע המקביל באתר הזה. שים לב
במיוחד לערכים **מקובעים בקוד** (hardcoded) שחייבים החלפה ידנית:
- `accent-[#b96a3b]` בסליידרים (צבע ה־accent של בינת התורה).
- צבעי שלוש הסדרות בגרף: `#3e6b4f` (ירוק-הצלחה), `#413055` (סגול-primary),
  `#b96a3b` (נחושת-accent).
- `rgba(46,36,56,…)` בצללי המגירה (נגזרת של צבע ה־ink של בינת התורה).
- `#e9ddd2` (קווי רשת בגרף) ו־`#94897e` (מספרי ציר) — נגזרות של ה־border/foreground.

### שלב 3 — הצע התאמה פדגוגית ומתודולוגית
הצג לרפאל הצעה מנומקת:
- **אילו מדדים למדוד באתר הזה.** המבנה המקורי: מדד קושי אחד + שני מדדי התקדמות
  במיומנויות הליבה. אם לאתר הזה יש מיומנות אחת, שלוש, או מבנה אחר (למשל: ידע /
  הבנה / חיבור אישי) — הצע התאמה, כולל ההשלכות על סכמת ה־DB ועל הגרף.
- **התאמת אוצר המילים** לשפת האתר (למשל: אם באתר זה "העמקה" ולא "פענוח הפשט").
- שמור על העיקרון הפדגוגי (סעיף "הפדגוגיה" למטה) גם אם המדדים משתנים.

### שלב 4 — שאל את רפאל במפורש
> "האם באתר זה השאלות לתלמיד/ה יהיו שונות, או לשמור על אותן שאלות
> (קושי + התקדמות בכל אחת משתי המיומנויות + טקסט חופשי)?"

רק אחרי אישור על שלושת הסעיפים — מיישמים.

---

## הקונספט והפדגוגיה (אין לשנות את העקרונות, רק את היישום)

**מה זה:** בסוף כל שיעור — או בכל רגע — התלמיד עוצר לרפלקציה קצרה: כמה היה קשה,
וכמה הרגיש שהתקדם בכל אחת ממיומנויות הליבה, בתוספת שדה טקסט חופשי.

**עקרונות שאין לוותר עליהם:**

1. **זמינות תמידית, לא רק בסוף משימה.** שיעור לא תמיד נגמר כשמשימה נגמרת. לכן זו
   **מגירת צד קבועה** שמופיעה בכל עמוד פנימי של האתר, לא מסך סיום.
2. **מגירה פיזית אמיתית.** ידית קטנה מציצה מצד המסך בגובה אמצע; הפאנל נשלף בדיוק
   מהמקום שבו הידית נמצאת (הידית מוצמדת לחזית המגירה ונעה יחד איתה, כמו מגירה
   אמיתית). הידית תומכת גם **בגרירה ממשית** (משיכה מעבר לחצי → נפתח; עזיבה מוקדמת →
   נסגר בחזרה) וגם בהקשה פשוטה (toggle).
3. **מדדים כצירים בין שני קטבים,** לא ציונים. כל סליידר נמתח בין שני קטבים מנוסחים
   בשפת תלמידים עם אימוג'י ("קל מאוד 😌" ↔ "קשה מאוד 🥵"; "דרכתי במקום" ↔
   "צעד ענק 🚀"). סקאלה 1–10.
4. **ההקשר נלכד אוטומטית** — התלמיד לא ממלא שום מטא-דאטה: תאריך, שעה, המשימה
   הנוכחית (אם יש) והקשר הפרק/העמוד נשמרים לבד.
5. **הרפלקציה צומחת.** בצד התלמיד: ארכיון ויזואלי + **גרף מגמה לאורך זמן** בעמוד
   האישי (התקווה: קו שמטפס 🌱). בצד המורה: הרפלקציות האחרונות מופיעות בדשבורד עם
   שם, הקשר וזמן.
6. **חיזוק חיובי, בלי שיפוטיות.** אישור השמירה חם ("הרפלקציה נשמרה! 🌱") ומפנה
   לגרף האישי. אין ציון, אין "נכון/לא נכון".
7. **אורחים לא רואים את המגירה** (אין למי לשמור), והרכיב מוצג רק למשתמש מחובר.

---

## ארכיטקטורה — ארבעה חלקים

| חלק | קובץ במקור | תפקיד |
|---|---|---|
| סכמת DB | `migrations/0003_reflection_debate_writing.sql` (החלק הרלוונטי) | טבלת `reflections` |
| API | `app/api/reflections/route.ts` | ‏POST לשמירה, עם clamp ואימות התחברות |
| רכיב המגירה | `components/reflection-drawer.tsx` | ידית + פאנל נגרר + סליידרים + שמירה |
| רכיב הגרף | `components/reflection-graph.tsx` | SVG בצד-שרת, שלוש סדרות, RTL |

ונקודות עיגון: עטיפת העמודים המשותפת, עמוד משימה (עם `taskId`), עמוד אישי
(ארכיון + גרף), דשבורד מורה (פיד אחרון).

---

## 1) סכמת ה־DB

```sql
-- Reflections: end-of-lesson (or anytime, via the side drawer) self-assessment.
-- Auto-captured context: task + chapter ref + timestamp.
CREATE TABLE IF NOT EXISTS reflections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  task_id INTEGER REFERENCES tasks(id),
  context_ref TEXT,                     -- e.g. 'במדבר ט׳ · ״לָמָּה נִגָּרַע?״' or page name
  difficulty INTEGER NOT NULL,          -- 1-10: קל מאוד → קשה מאוד
  pshat_progress INTEGER NOT NULL,      -- 1-10: progress feeling in core skill #1
  argument_progress INTEGER NOT NULL,   -- 1-10: progress feeling in core skill #2
  note TEXT,                            -- free text
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reflections_user ON reflections(user_id, created_at);
```

**התאמה:** אם המדדים באתר היעד שונים (שלב 3) — שנה את שמות/מספר עמודות ה־progress
בהתאם, ועדכן את ה־API, המגירה והגרף במקביל. שמות עמודות באנגלית תמיד.

## 2) ה־API — ‏`app/api/reflections/route.ts`

```ts
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function clamp(v: unknown): number {
  return Math.min(10, Math.max(1, Math.round(Number(v))));
}

// Save a reflection. Context (task, chapter, time) is captured automatically
// by the drawer and stored with full metadata.
export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || user.guest) {
    return NextResponse.json({ error: "נדרשת התחברות." }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const difficulty = clamp(body?.difficulty);
  const pshat = clamp(body?.pshatProgress);
  const argument = clamp(body?.argumentProgress);
  const note = body?.note ? String(body.note).slice(0, 4000) : null;
  const taskId = body?.taskId ? Number(body.taskId) : null;
  const contextRef = body?.contextRef ? String(body.contextRef).slice(0, 300) : null;

  await db().execute({
    sql: `INSERT INTO reflections
            (user_id, task_id, context_ref, difficulty, pshat_progress, argument_progress, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [Number(user.id), taskId, contextRef, difficulty, pshat, argument, note, now()],
  });
  return NextResponse.json({ ok: true });
}
```

נקודות שאסור לאבד בתרגום לסטאק אחר: clamp צד-שרת ל־1–10, קיטום אורכי טקסט,
חסימת אורחים, timestamp יוניקס בשניות.

## 3) רכיב המגירה — ‏`components/reflection-drawer.tsx` (קוד מלא)

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

// The reflection drawer — styled and behaving like a REAL drawer:
// a small handle sticks out of the side of the screen at mid-height;
// the panel slides out from exactly where the handle is (the handle stays
// attached to the drawer front, like pulling a physical drawer);
// the handle supports actual DRAG (pointer) — pull past halfway and it
// opens, let go early and it snaps back — plus a simple tap/click toggle.
// Context (task, chapter, date+time) is captured automatically.

const HANDLE_W = 30; // px

export default function ReflectionDrawer({
  taskId,
  contextRef,
}: {
  taskId?: number;
  contextRef: string;
}) {
  const [open, setOpen] = useState(false);
  const [panelW, setPanelW] = useState(340);
  const [dragX, setDragX] = useState<number | null>(null);
  const dragStart = useRef<{
    x: number;
    base: number;
    moved: boolean;
    last: number;
  } | null>(null);

  const [difficulty, setDifficulty] = useState(5);
  const [pshat, setPshat] = useState(5);
  const [argument, setArgument] = useState(5);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");

  useEffect(() => {
    const compute = () =>
      setPanelW(Math.min(340, Math.round(window.innerWidth * 0.84)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // Horizontal translate of the drawer assembly. The drawer lives on the
  // inline-end side (left in RTL): closed = panel pushed off-screen left,
  // only the handle peeks out; open = flush with the edge.
  const closedX = -panelW;
  const currentX = dragX ?? (open ? 0 : closedX);
  const dragging = dragX !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // some browsers/synthetic events can't capture — dragging still works
    }
    const base = open ? 0 : closedX;
    dragStart.current = { x: e.clientX, base, moved: false, last: base };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.x;
    if (Math.abs(dx) > 4) dragStart.current.moved = true;
    const next = Math.max(closedX, Math.min(0, dragStart.current.base + dx));
    dragStart.current.last = next;
    setDragX(next);
  };
  const onPointerUp = () => {
    if (!dragStart.current) return;
    const { moved, last } = dragStart.current;
    dragStart.current = null;
    setDragX(null);
    if (!moved) {
      // simple tap — toggle
      setOpen((o) => !o);
      return;
    }
    setOpen(last > closedX / 2); // pulled past halfway → open, else snap back
  };

  const submit = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/reflections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          contextRef,
          difficulty,
          pshatProgress: pshat,
          argumentProgress: argument,
          note,
        }),
      });
      if ((await res.json()).ok) {
        setState("done");
        setTimeout(() => {
          setOpen(false);
          setState("idle");
          setNote("");
        }, 2200);
      } else setState("idle");
    } catch {
      setState("idle");
    }
  };

  const nowLabel = new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());

  return (
    <>
      {/* backdrop — only when open */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/25"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* the drawer assembly: panel + attached handle, sliding together */}
      <div
        className="fixed z-50"
        style={{
          insetInlineEnd: 0,
          top: "50%",
          transform: `translateY(-50%) translateX(${currentX}px)`,
          transition: dragging
            ? "none"
            : "transform 380ms cubic-bezier(0.25, 1.1, 0.35, 1.05)",
          display: "flex",
          alignItems: "center",
          insetInlineStart: "auto",
        }}
        dir="rtl"
      >
        {/* handle — small, attached to the drawer front */}
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={open ? "סגירת הרפלקציה" : "פתיחת הרפלקציה"}
          aria-expanded={open}
          className="flex select-none flex-col items-center justify-center gap-0.5 rounded-s-xl shadow-md"
          style={{
            width: HANDLE_W,
            height: 68,
            background: "var(--primary)",
            color: "#fff",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            border: "none",
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>
            🪞
          </span>
          {/* drawer-handle groove lines */}
          <span
            aria-hidden
            style={{
              width: 3,
              height: 22,
              borderRadius: 2,
              background: "rgba(255,255,255,0.45)",
            }}
          />
        </button>

        {/* the drawer panel */}
        <aside
          aria-hidden={!open && !dragging}
          className="overflow-y-auto rounded-s-2xl border-s border-y border-[color:var(--border)] shadow-2xl"
          style={{
            width: panelW,
            maxHeight: "76vh",
            background: "var(--card)",
            // subtle "inside of a drawer" depth on the leading edge
            boxShadow:
              "inset -12px 0 18px -14px rgba(46,36,56,0.35), 0 18px 45px -18px rgba(46,36,56,0.45)",
          }}
        >
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <p className="font-display text-base font-bold text-[color:var(--primary)]">
              🪞 רגע של רפלקציה
            </p>
            <p className="text-[10px] text-[color:var(--primary)]/55">
              {nowLabel} · {contextRef}
            </p>
          </div>

          {state === "done" ? (
            <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
              <span className="text-4xl">🌱</span>
              <p className="font-display text-base font-bold text-[color:var(--success)]">
                הרפלקציה נשמרה!
              </p>
              <p className="text-[11px] text-[color:var(--foreground)]/60">
                כל הרפלקציות והגרף שלך — בעמוד האישי.
              </p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <PoleSlider
                label="כמה קשה היה לי היום?"
                right="קל מאוד 😌"
                left="קשה מאוד 🥵"
                value={difficulty}
                onChange={setDifficulty}
              />
              <PoleSlider
                label="התקדמות בפענוח הפשט 📖"
                right="דרכתי במקום"
                left="צעד ענק 🚀"
                value={pshat}
                onChange={setPshat}
              />
              <PoleSlider
                label="התקדמות במיומנות הטיעון ⚖️"
                right="דרכתי במקום"
                left="צעד ענק 🚀"
                value={argument}
                onChange={setArgument}
              />
              <label className="block">
                <span className="mb-1 block text-xs font-bold text-[color:var(--primary)]">
                  במילים שלי 💬
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="מה היה משמעותי? מה הפתיע? מה עוד מבלבל?"
                  className="w-full rounded-lg border border-[color:var(--border)] bg-white px-3 py-2 text-xs leading-5 outline-none focus:border-[color:var(--accent)]"
                />
              </label>
              <button
                onClick={submit}
                disabled={state === "busy"}
                className="w-full rounded-full bg-[color:var(--primary)] py-2.5 text-xs font-bold text-white shadow transition hover:scale-[1.01] disabled:opacity-50"
              >
                {state === "busy" ? "שומרים..." : "שמירת הרפלקציה 🌱"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function PoleSlider({
  label,
  right,
  left,
  value,
  onChange,
}: {
  label: string;
  right: string;
  left: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-bold text-[color:var(--primary)]">{label}</p>
      <input
        type="range"
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#b96a3b]"
      />
      <div className="flex justify-between text-[10px] text-[color:var(--primary)]/55">
        <span>{right}</span>
        <span className="font-display text-xs font-bold text-[color:var(--accent)]">
          {value}
        </span>
        <span>{left}</span>
      </div>
    </div>
  );
}
```

**שים לב לשני הסליידרים האמצעיים** — "התקדמות בפענוח הפשט 📖" ו"התקדמות במיומנות
הטיעון ⚖️" הם מיומנויות-הליבה של בינת התורה. **כאן נכנסת ההתאמה משלב 3.**

## 4) רכיב הגרף — ‏`components/reflection-graph.tsx` (קוד מלא)

```tsx
// Server-rendered SVG trend graph of a student's reflections over time.
// Three lines: difficulty (inverted feel — lower is easier), pshat progress,
// argument progress. Hoping the trend climbs 🌱

export interface ReflectionPoint {
  createdAt: number;
  difficulty: number;
  pshat: number;
  argument: number;
}

const W = 560;
const H = 180;
const PAD = 28;

function path(points: ReflectionPoint[], pick: (p: ReflectionPoint) => number): string {
  if (points.length === 0) return "";
  const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
  return points
    .map((p, i) => {
      const x = W - PAD - i * xStep; // RTL: first point on the right
      const y = H - PAD - ((pick(p) - 1) / 9) * (H - PAD * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export default function ReflectionGraph({ points }: { points: ReflectionPoint[] }) {
  if (points.length === 0) return null;
  const series = [
    { key: "pshat", color: "#3e6b4f", label: "📖 פענוח הפשט", pick: (p: ReflectionPoint) => p.pshat },
    { key: "argument", color: "#413055", label: "⚖️ מיומנות הטיעון", pick: (p: ReflectionPoint) => p.argument },
    { key: "difficulty", color: "#b96a3b", label: "🌡️ רמת הקושי", pick: (p: ReflectionPoint) => p.difficulty },
  ];
  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-xl bg-[color:var(--background)]"
        role="img"
        aria-label="גרף מגמת הרפלקציות שלי"
      >
        {[1, 5, 10].map((v) => {
          const y = H - PAD - ((v - 1) / 9) * (H - PAD * 2);
          return (
            <g key={v}>
              <line x1={PAD} x2={W - PAD} y1={y} y2={y} stroke="#e9ddd2" strokeWidth="1" />
              <text x={W - PAD + 4} y={y + 3} fontSize="9" fill="#94897e">
                {v}
              </text>
            </g>
          );
        })}
        {series.map((s) => (
          <path
            key={s.key}
            d={path(points, s.pick)}
            fill="none"
            stroke={s.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={s.key === "difficulty" ? 0.55 : 0.9}
          />
        ))}
        {points.map((p, i) => {
          const xStep = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0;
          const x = W - PAD - i * xStep;
          return series.map((s) => {
            const y = H - PAD - ((s.pick(p) - 1) / 9) * (H - PAD * 2);
            return <circle key={`${i}-${s.key}`} cx={x} cy={y} r="3" fill={s.color} />;
          });
        })}
      </svg>
      <div className="mt-2 flex flex-wrap justify-center gap-4 text-[11px]">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
```

עקרונות הגרף: SVG טהור בצד-שרת (בלי ספריות), **ציר הזמן רץ מימין לשמאל** (RTL —
הנקודה הראשונה מימין), קווי רשת ב־1/5/10, קו הקושי שקוף יותר (0.55) כי הוא "מדד
הפוך" — ירידה שלו היא בשורה טובה. הגרף מוצג רק מ־2 נקודות ומעלה.

## 5) נקודות עיגון

**א. עטיפת עמודים משותפת** (אצלנו `components/page-shell.tsx`) — המגירה חיה בכל
עמוד פנימי, ליד ה־TopNav, עם שם העמוד כהקשר. אורחים לא מקבלים אותה:

```tsx
const showDrawer = Boolean(session?.user) && !session?.user?.guest;
// ...
{showDrawer && <ReflectionDrawer contextRef={title} />}
```

**ב. עמוד משימה** — שם ההקשר עשיר יותר וכולל `taskId`:

```tsx
{!guest && (
  <ReflectionDrawer
    taskId={taskId}
    contextRef={`${reg.content.bookRef} · ${reg.content.title}`}
  />
)}
```

**ג. העמוד האישי של התלמיד** — ארכיון + גרף. שליפה ממוינת עולה (ישן→חדש, בשביל
הגרף), רשימה מוצגת הפוכה (חדש למעלה), עם empty-state מעודד:

```tsx
const refRes = await db().execute({
  sql: `SELECT context_ref, difficulty, pshat_progress, argument_progress, note, created_at
        FROM reflections WHERE user_id = ? ORDER BY created_at ASC`,
  args: [userId],
});
// ...render:
// <h2>🪞 הרפלקציות שלי (N)</h2>
// אם ריק: "בסוף כל שיעור (או בכל רגע, דרך לשונית הרפלקציה בצד) ... והגרף שלך יצמח כאן 🌱"
// אם ≥2: <ReflectionGraph points={reflections} />
// ואז רשימת כרטיסים: תאריך+שעה+הקשר, שלושת הערכים, והטקסט החופשי אם יש.
```

**ד. דשבורד המורה** — פיד "🪞 רפלקציות אחרונות מהכיתה" (25 אחרונות, JOIN לשם
התלמיד, סטודנטים בלבד):

```sql
SELECT u.full_name, u.email, r.context_ref, r.difficulty, r.pshat_progress,
       r.argument_progress, r.note, r.created_at
FROM reflections r JOIN users u ON u.id = r.user_id
WHERE u.role = 'student'
ORDER BY r.created_at DESC LIMIT 25
```

## 6) לקחי UX מהמימוש — חובה לשמר

1. **גרירה אמיתית, לא רק קליק.** ההבחנה בין tap לגרירה היא סף תזוזה של 4px
   (`moved`). בלי זה כל גרירה קטנה נספרת כקליק והמגירה "מרצדת".
2. **`setPointerCapture` עטוף ב־try/catch** — חלק מהדפדפנים/אירועים סינתטיים
   נכשלים בו, והגרירה עדיין עובדת בלעדיו.
3. **`touchAction: "none"` על הידית** — בלי זה מובייל מגלגל את הדף במקום לגרור.
4. **הידית והפאנל הם יחידה אחת שנעה יחד** (flex, ‏translateX משותף). אל תממש ידית
   קבועה + פאנל נפרד — זה שובר את אשליית המגירה.
5. **אזהרת containing block:** אלמנט `fixed` נלכד תחת כל אבא עם `backdrop-filter`
   / `transform` / `filter`. אם המגירה מופיעה "כלואה" בתוך ההדר — חפש
   `backdrop-blur` אצל האבות (זו הייתה תקלה אמיתית אצלנו; הוסר blur מה־header).
6. **רוחב רספונסיבי:** `min(340px, 84vw)` מחושב ב־resize — במובייל המגירה לא
   מכסה את כל המסך.
7. **בזמן גרירה אין transition** (`transition: none` כש־dragging) — אחרת הפאנל
   "נגרר אחרי האצבע" בפיגור גומי.
8. **אימות ויזואלי בדפדפן ללא-ראש:** אם בודקים עם pane מוסתר, ‏CSS transitions
   קופאים — לוודא מצב דרך ה־DOM/inline styles, לא דרך צילומי ביניים.

## 7) צ'ק-ליסט יישום (אחרי אישור רפאל)

1. מיגרציה אדיטיבית חדשה (`migrations/00NN_reflections.sql`) + הרצה.
2. ‏API route עם clamp/auth כמו למעלה.
3. רכיב מגירה — עם המדדים והנוסחים שאושרו, פלטה מותאמת, לשון פנייה מותאמת.
4. רכיב גרף — סדרות לפי המדדים שאושרו, צבעים מהפלטה של האתר.
5. עיגון: עטיפת עמודים (ללא אורחים) + עמוד משימה (עם taskId) + עמוד אישי
   (ארכיון+גרף) + דשבורד מורה (פיד).
6. `tsc --noEmit` + production build.
7. בדיקה חיה בדפדפן: פתיחה בגרירה ובהקשה, שליחה, הופעה בעמוד האישי ובדשבורד,
   מובייל (רוחב, touch), אורח לא רואה ידית.
8. קומיט באנגלית.

---

## 8) שדרוג הגרפים — "רפלקציה 2.0" (חובה: זו הגרסה הנוכחית)

> נוסף בעקבות בקשת הרכזת הפדגוגית (2026-08). רכיב הגרף הבסיסי מסעיף 4 הוחלף
> במערכת חיה. אם אתם בונים מאפס — בנו ישר את הגרסה הזו ודלגו על sec. 4.

**מה המערכת כוללת:**

1. **עמוד אישי לתלמיד/ה — גרף חי:** עקומות חלקות (Catmull-Rom→bezier) בכיוון
   RTL (נקודה ראשונה מימין), מילוי גרדיאנט מתחת לקווי המיומנויות, קו הקושי
   מקווקו ושקוף יותר (מדד הפוך — ירידה היא טובה), crosshair בריחוף + tooltip
   עברי (תאריך, שלושת הערכים עם נקודות צבע, קטע מהטקסט החופשי), ציר תאריכים
   (~4 תוויות), נקודות עם טבעת-משטח לבנה, ומעל הגרף צ'יפים של מגמה: הערך
   האחרון בכל מדד + חץ ↑/↓ מול הרפלקציה הראשונה (ירידה בקושי = ירוק).
   רענון רך: כל 30 שניות + בפוקוס חלון (רפלקציה שנשמרה מהמגירה מופיעה בלי
   טעינת עמוד). מצבי ריק: 0 נקודות = משפט מעודד; נקודה אחת = "עוד רפלקציה
   אחת — ויצמח כאן קו 🌱".
2. **דשבורד מורה — "מסע הרפלקציה של הכיתה":** (א) צ'יפים: סה"כ רפלקציות,
   כמה שיתפו מתוך הכיתה, כמה בשבוע האחרון; (ב) **גרף ממוצע כיתתי לפי ימים** —
   כל הרפלקציות של כל התלמידים באותו יום קלנדרי (שעון ישראל) ממוצעות פר-מדד,
   באותו רכיב גרף (ה-tooltip מציג "N רפלקציות ביום זה"); (ג) **"המסע של כל
   תלמיד/ה" — בורר, לא רשת!** (הערת רפאל: אסור שהדשבורד יימתח לאינסוף עם
   גרף מתחת לגרף כמספר התלמידים): שורת צ'יפים עם שמות התלמידים (ממוינת לפי
   פעילות אחרונה, עם מספר הרפלקציות; חסרי-רפלקציה מעומעמים; המיכל מוגבל
   גובה עם גלילה פנימית) — ולחיצה מציגה **גרף מלא אחד** של הנבחר/ת, עם שורת
   תקציר והטקסט של הרפלקציה האחרונה. ברירת מחדל: מי ששיתפ/ה לאחרונה.
   סה"כ שני גרפים בעמוד תמיד, בלי תלות בגודל הכיתה. רענון כל 45 שניות +
   פוקוס. רשימת "הרפלקציות האחרונות — במילים שלהם" נשארת מתחת (הטקסט
   החופשי חשוב למורה).
3. **API קריאה** — הרחבת אותו route של השמירה:

```ts
// GET /api/reflections            → הסדרה של המשתמש המחובר
// GET /api/reflections?scope=class → כל התלמידים (מורה בלבד, 403 אחרת)
// תשובת class: { ok, students: [{ id, name, points: TrendPoint[] }] }
// תשובת עצמי:  { ok, points: TrendPoint[] }
// TrendPoint: { t (unix sec), difficulty, pshat, argument, note?, contextRef? }
// הממוצע הכיתתי מחושב בצד הלקוח (bucket לפי יום קלנדרי Asia/Jerusalem).
```

**צבעי הסדרות — לא הצבעים הגולמיים של הפלטה!** לקח חשוב: צבעי מותג כהים/
אפרוריים נכשלים כקווי גרף (בהירות מחוץ לטווח, כרומה נמוכה שנקראת אפור).
בבינת התורה נגזרו וריאנטים בהירים של אותם גוונים ואומתו בכלי בדיקת פלטות
(בהירות, כרומה, הפרדת עיוורון-צבעים ΔE≥8, קונטרסט ≥3:1 מול המשטח):
`#3f8a5f` (מיומנות 1) · `#7c5ba6` (מיומנות 2) · `#c06b32` (קושי, מקווקו).
באתר היעד: גזרו וריאנטים דומים מהפלטה המקומית ואמתו — אל תשתמשו בצבעי
ה-CSS variables ישירות בלי בדיקה.

**כללי עיצוב שחובה לשמר** (מתודולוגיית dataviz): קווים 2-2.5px; סמנים ≥8px
קוטר עם טבעת בצבע המשטח; רשת ואקססוריות שקטות (var(--border), טקסט ציר
ב-ink מעומעם); טקסט תמיד בצבעי טקסט — לעולם לא בצבע הסדרה (זהות מועברת
בנקודת צבע לצדו); מקרא תמיד נוכח ל-3 סדרות; ציר y אחד משותף (כל המדדים
1–10 — אין ציר כפול); x לפי אינדקס רפלקציה (מרווח שווה) עם תוויות תאריך,
לא לפי זמן-קיר (נתוני-מפגשים, לא רציפים).

**הקבצים במקור** (להעתקה מלאה — בקשו מרפאל או משכו מהריפו binat-hatorah):
- `components/reflection-trend.tsx` — רכיב הגרף (וריאנט מלא + mini, tooltip, מקרא)
- `components/me-reflections.tsx` — עטיפת התלמיד/ה (initialPoints מהשרת + polling)
- `components/class-reflections.tsx` — פאנל הכיתה (ממוצע יומי + רשת מיני)
- `app/api/reflections/route.ts` — ה-GET (לצד ה-POST הקיים)

**עיגון:** ב-me — `<MeReflections initialPoints={...} />` בתוך כרטיס
"הרפלקציות שלי" (הארכיון הטקסטואלי נשאר מתחת); בדשבורד — כרטיס חדש
"🪞 מסע הרפלקציה של הכיתה" עם `<ClassReflections />` מעל רשימת הרפלקציות
האחרונות. הרכיב הישן מסעיף 4 (reflection-graph) נמחק.

## נספח א' — אם הסטאק שונה

הקוד לעיל מניח: Next.js App Router, ‏next-auth (`auth()` עם `user.guest`), ‏Turso
libSQL ב־SQL גולמי (`db().execute`), ‏Tailwind v4 עם משתני CSS בעברית-RTL גלובלית
(`<html dir="rtl">`). אם האתר היעד שונה:

- **אין next-auth:** החלף את בדיקת ההתחברות במנגנון של האתר; שמור על העיקרון
  שאורח/לא-מחובר לא שומר ולא רואה מגירה.
- **ORM במקום SQL גולמי:** תרגם את הסכימה והשאילתות; שמור אינדקס על
  `(user_id, created_at)`.
- **אין Tailwind:** ה־classNames מתורגמים ל־CSS רגיל; הערכים החשובים הם אלה
  שב־style הישיר (מנגנון הגרירה לא תלוי Tailwind בכלל).
- **אתר LTR:** הפוך את הלוגיקה — `insetInlineEnd`/`rounded-s-*`/`border-s` הם
  logical properties ויתהפכו לבד, אבל כיוון הגרירה (`closedX` שלילי) והגרף
  (נקודה ראשונה מימין) בנויים ל־RTL ויש להפוך.
- **React אחר / בלי שרת רנדור:** הגרף הוא רכיב טהור ללא state — עובד בכל מקום.

## נספח ב' — נוסח ברירת המחדל של השאלות (לשאלת שלב 4)

אם רפאל בוחר "לשמור על אותן שאלות", אלו הן, מילה במילה:

1. "כמה קשה היה לי היום?" — קטבים: "קל מאוד 😌" ↔ "קשה מאוד 🥵"
2. "התקדמות ב<מיומנות ליבה 1> 📖" — קטבים: "דרכתי במקום" ↔ "צעד ענק 🚀"
3. "התקדמות ב<מיומנות ליבה 2> ⚖️" — קטבים: "דרכתי במקום" ↔ "צעד ענק 🚀"
4. "במילים שלי 💬" — placeholder: "מה היה משמעותי? מה הפתיע? מה עוד מבלבל?"

כותרת המגירה: "🪞 רגע של רפלקציה". אישור: "הרפלקציה נשמרה!" + "כל הרפלקציות
והגרף שלך — בעמוד האישי." כפתור: "שמירת הרפלקציה 🌱" / בזמן שמירה: "שומרים...".
(התאם לשון פנייה — "שלך" נשאר ניטרלי; "תוכלי/תוכל" ב־empty-state לפי האתר.)
