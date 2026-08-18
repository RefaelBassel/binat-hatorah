# דופק כיתה + לוח הקרנה — מסמך העברה מלא לאתרי למידה אחרים

> **מסמך זה מיועד ל-Claude Code בפרויקט אחר.** הוא מכיל את כל מה שנדרש כדי לבנות
> את פיצ'ר המעקב הכיתתי החי במלואו — קונספט, החלטות מוצר שכבר הוכרעו, API,
> קוד רכיבים מלא, נקודות עיגון, ולקחי באגים אמיתיים — בלי שרפאל יצטרך להסביר דבר.
>
> **המקור:** האתר "בינת התורה" (binat-hatorah, Next.js 16 + Turso + Tailwind v4),
> שם הפיצ'ר בנוי, פועל בפרודקשן ואושר. הקוד הועתק אחד-לאחד מהמימוש החי.

---

## ✅ החלטות מוצר שכבר הוכרעו — לא לשאול עליהן שוב

אלה בדיוק השאלות ששואלים בפעם הראשונה. רפאל כבר הכריע בהן במימוש המקורי:

1. **איפה נפתחת המגירה?** בשני מקומות: (א) עמוד המשימה עצמו כשמורה צופה בו,
   (ב) עמוד המשימה בדשבורד המורה. ידית קטנה בצד המסך (מעל ידית הרפלקציה אם
   קיימת), נפתחת בגרירה או בהקשה — **לא** עמוד נפרד ו**לא** רכיב בתוך הדשבורד.
2. **מי רואה אותה?** מורים בלבד. תלמידים לא רואים את הידית בכלל.
3. **ההקרנה** היא **עמוד נפרד ומלא** (route משלו), בלי תפריטים ובלי ניווט —
   נקי לפרויקטור. נפתח בטאב חדש מכפתור "🖥️ הקרנה על הלוח" שבתוך המגירה
   (וגם מכפתור בעמוד המשימה בדשבורד). גלוי רק למורה (redirect לכל אחד אחר).
4. **"פעיל/ה כרגע"** = דופק שעון-העבודה של התלמיד/ה נשלח ב-2 הדקות האחרונות
   (ה-heartbeat רץ כל ~20 שניות כשחלון המשימה גלוי). לא צריך WebSockets —
   polling של המורה כל 4–5 שניות מספיק לגמרי לכיתה.
5. **"לא נוכח/ת"** = מוקצה למשימה אבל בלי דופק חי (כולל "טרם פתח/ה את המשימה").
   מוצג בקבוצה נפרדת, מעומעם. מי שהגיש/ה — קבוצה שלישית, חגיגית.
6. **חלוקת ההתקדמות שווה לכל שאלה:** כל יחידת-מענה במשימה שווה בערכה —
   ומודדים כמה יחידות כל תלמיד/ה השלים/ה מתוך הסך. (מה נחשב "יחידה" — ראו
   שלב ההתאמה למטה, זה החלק היחיד שתלוי באתר.)
7. **שמות:** התלמידים מופיעים בשמם המלא בעברית (מה-onboarding), עם fallback
   למייל רק אם אין שם.
8. **מצב תלמיד:** אם לאתר יש "מצב תלמיד" למורה (טוגל שמדמה חוויית תלמיד) —
   המגירה מוסתרת בו: `{isTeacher && !(await isStudentMode()) && <ClassPulseDrawer ... />}`.
   כלי מורה לא מציץ בתוך חוויית תלמיד.

---

## ‼️ פרוטוקול התאמה — לפני שורת קוד אחת

### שלב 1 — למד את מודל המשימות של האתר הזה
המימוש המקורי בנוי על מודל שבו למשימה יש: שלבי-ליבה קבועים (7 שלבי פענוח) +
שאלות הבנה + שאלות העמקה עם שדות. באתר היעד המבנה כנראה שונה. ברר:
- מהי רשימת "יחידות המענה" של משימה (שאלות/שלבים/שדות), ואיך היא נגזרת
  מהתוכן. **זו ההחלטה המרכזית** — כל השאר גנרי.
- איך נשמרות תשובות (טבלה? מפתח פר-שאלה?), איך נשמרת התקדמות/שלב,
  והאם קיים heartbeat של זמן-עבודה שמעדכן `updated_at` (אם לא — צריך
  להוסיף אחד; דפוס ה-timer מצורף בנספח ב').
- מי "הכיתה": טבלת הקצאות פר-משימה? כל התלמידים? קבוצות?

### שלב 2 — הצע לרפאל התאמה קצרה ובקש אישור
הצג: (א) הגדרת "יחידה" המוצעת לאתר הזה; (ב) התאמת פלטה (הקוד למטה משתמש
במשתני CSS ‏`--primary/--accent/--success/--danger/--border/--card/--background`
— מפה אותם לפלטה המקומית); (ג) אם אין heartbeat — שתוסיף אחד. שאלה אחת
ממוקדת מותרת: "מה נחשב יחידת-מענה במשימות של האתר הזה?" — ואם התשובה כבר
נגזרת בבירור מהקוד, אל תשאל בכלל. יתר ההחלטות — סגורות (הרשימה למעלה).

---

## ארכיטקטורה — שלושה חלקים

| חלק | קובץ במקור | תפקיד |
|---|---|---|
| API | `app/api/tasks/[taskId]/class-status/route.ts` | GET, מורה בלבד: רשימת יחידות + מצב כל תלמיד/ה |
| מגירה | `components/class-pulse-drawer.tsx` | ידית נגררת, polling כל 5 שניות, שלוש קבוצות |
| לוח | `components/class-board.tsx` + `app/dashboard/class-board/[taskId]/page.tsx` | עמוד הקרנה מלא, polling כל 4 שניות, שעון חי |

נתונים נדרשים (שמות הטבלאות במקור — התאם לאתר היעד):
- `task_assignments(task_id, user_id)` — מי בכיתה למשימה הזו.
- `task_progress(task_id, user_id, stage, work_seconds, submitted_at, updated_at)`
  — `updated_at` מתעדכן ע"י heartbeat כל ~20 שניות בזמן עבודה. זה גלאי הנוכחות.
- `task_answers(task_id, user_id, question_key, answer)` — תשובה פר-מפתח-שאלה;
  "נענתה" = `TRIM(answer) <> ''`.

## 1) ה-API (קוד מלא מהמקור)

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/api-auth";
import { getTask, now } from "@/lib/tasks";
import {
  getTaskContent,
  countTaskUnits,
  DECODE_STAGES,
} from "@/content/tasks/registry";
import type { QuestionBlock } from "@/content/tasks/types";

// Live class status for one task — teacher only. Every question weighs the
// same: 7 decode stages + comprehension answers + every Part-B answer field.
// Presence comes from the work-stopwatch heartbeat (task_progress.updated_at,
// beaten every ~20s while the student's window is visible).
const ACTIVE_WINDOW = 120; // seconds since last heartbeat = "in class, working"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const guard = await requireTeacher();
  if (!guard.ok) return guard.res;
  const { taskId: raw } = await params;
  const task = await getTask(Number(raw));
  if (!task) {
    return NextResponse.json({ error: "המשימה לא נמצאה." }, { status: 404 });
  }
  const reg = getTaskContent(task.content_ref);
  if (!reg) {
    return NextResponse.json({ error: "תוכן המשימה לא נמצא." }, { status: 404 });
  }

  // ===== ADAPT HERE: the equal-weight unit list, in reading order =====
  // בינת התורה: 7 שלבי פענוח + שאלות הבנה + כל שדה תשובה בחלק ב.
  // באתר היעד: גזרו את רשימת היחידות ממודל המשימות המקומי. כל יחידה:
  // { key, label, part } כאשר key חייב להתאים למפתח שבטבלת התשובות.
  const units: { key: string; label: string; part: "a" | "b" }[] = [];
  for (const s of DECODE_STAGES) {
    units.push({ key: `stage:${s.n}`, label: s.title, part: "a" });
  }
  for (const c of reg.content.comprehension) {
    units.push({ key: `comp:${c.key}`, label: "בדיקת הבנה", part: "a" });
  }
  for (const sec of reg.content.sections) {
    for (const b of sec.blocks) {
      if (b.type !== "question") continue;
      const q = b as QuestionBlock;
      if (q.fields?.length) {
        for (const f of q.fields) {
          units.push({ key: `${q.key}:${f.key}`, label: q.label, part: "b" });
        }
      } else {
        units.push({ key: q.key, label: q.label, part: "b" });
      }
    }
  }
  // ===== end ADAPT =====
  const answerKeys = new Set(
    units.filter((u) => !u.key.startsWith("stage:")).map((u) => u.key)
  );

  const roster = await db().execute({
    sql: `SELECT u.id, u.full_name, u.email,
                 p.stage, p.submitted_at, p.updated_at, p.work_seconds, p.opened_at
          FROM task_assignments a
          JOIN users u ON u.id = a.user_id
          LEFT JOIN task_progress p ON p.task_id = a.task_id AND p.user_id = a.user_id
          WHERE a.task_id = ?
          ORDER BY u.full_name`,
    args: [task.id],
  });
  const answers = await db().execute({
    sql: `SELECT user_id, question_key FROM task_answers
          WHERE task_id = ? AND TRIM(answer) <> ''`,
    args: [task.id],
  });
  const answeredBy = new Map<number, Set<string>>();
  for (const r of answers.rows) {
    const uid = Number(r.user_id);
    const key = String(r.question_key);
    if (!answerKeys.has(key)) continue;
    if (!answeredBy.has(uid)) answeredBy.set(uid, new Set());
    answeredBy.get(uid)!.add(key);
  }

  const t = now();
  const students = roster.rows.map((r) => {
    const uid = Number(r.id);
    const stage = r.stage != null ? Number(r.stage) : 0;
    const submitted = r.submitted_at != null;
    const lastBeat = r.updated_at != null ? Number(r.updated_at) : null;
    const opened = r.opened_at != null;
    const stagesDone = Math.min(Math.max(stage - 1, 0), 7); // ADAPT if no stages
    const done = answeredBy.get(uid) ?? new Set<string>();
    const unitsDone = stagesDone + done.size;
    const status = submitted
      ? "submitted"
      : lastBeat != null && t - lastBeat <= ACTIVE_WINDOW
        ? "active"
        : opened
          ? "idle"
          : "absent";
    return {
      id: uid,
      name: (r.full_name as string | null) ?? String(r.email),
      stage,
      unitsDone,
      doneKeys: [...done],
      workSeconds: r.work_seconds != null ? Number(r.work_seconds) : 0,
      lastBeat,
      status,
    };
  });

  return NextResponse.json({
    ok: true,
    now: t,
    task: {
      id: task.id,
      title: reg.content.title,
      subtitle: reg.content.subtitle,
      bookRef: reg.content.bookRef, // באתר היעד: המסכת/הסוגיה/ההקשר
      dueAt: task.due_at,
    },
    totalUnits: countTaskUnits(reg), // חייב להיות שווה לאורך units + השלבים
    units,
    students,
  });
}
```

## 2) המגירה (קוד מלא)

מכניקת "מגירה פיזית": ידית קטנה מציצה מהצד, הפאנל נשלף מאותה נקודה, גרירה
מעבר לחצי פותחת, הקשה עושה toggle. ה-polling רץ רק כשהמגירה פתוחה.

```tsx
"use client";

// דופק כיתה — teacher-only side drawer showing, live, how the whole class
// is doing on the task open right now: who is actively working (heartbeat
// within the last two minutes), how far each student is (every question
// weighs the same), who already submitted — and who is not present at all.
// A button opens the projectable class board in a new tab.

import { useEffect, useRef, useState } from "react";

interface StudentRow {
  id: number;
  name: string;
  stage: number;
  unitsDone: number;
  doneKeys: string[];
  workSeconds: number;
  lastBeat: number | null;
  status: "active" | "idle" | "submitted" | "absent";
}

interface ClassStatus {
  task: { id: number; title: string; subtitle: string; bookRef: string; dueAt: number };
  totalUnits: number;
  units: { key: string; label: string; part: "a" | "b" }[];
  students: StudentRow[];
}

const HANDLE_W = 30;

export default function ClassPulseDrawer({ taskId }: { taskId: number }) {
  const [open, setOpen] = useState(false);
  const [panelW, setPanelW] = useState(360);
  const [dragX, setDragX] = useState<number | null>(null);
  const dragStart = useRef<{ x: number; base: number; moved: boolean; last: number } | null>(null);
  const [data, setData] = useState<ClassStatus | null>(null);

  useEffect(() => {
    const compute = () => setPanelW(Math.min(360, Math.round(window.innerWidth * 0.88)));
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  // poll while open
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = () =>
      fetch(`/api/tasks/${taskId}/class-status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setData(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [open, taskId]);

  const closedX = -panelW;
  const currentX = dragX ?? (open ? 0 : closedX);
  const dragging = dragX !== null;

  const onPointerDown = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // capture is best-effort
    }
    dragStart.current = { x: e.clientX, base: open ? 0 : closedX, moved: false, last: open ? 0 : closedX };
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
      setOpen((o) => !o);
      return;
    }
    setOpen(last > closedX / 2);
  };

  const groups = data
    ? {
        active: data.students.filter((s) => s.status === "active"),
        submitted: data.students.filter((s) => s.status === "submitted"),
        away: data.students.filter((s) => s.status === "idle" || s.status === "absent"),
      }
    : null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setOpen(false)} aria-hidden />
      )}
      <div
        className="fixed z-50"
        style={{
          insetInlineEnd: 0,
          top: "24%",
          transform: `translateX(${currentX}px)`,
          transition: dragging ? "none" : "transform 380ms cubic-bezier(0.25, 1.1, 0.35, 1.05)",
          display: "flex",
          alignItems: "flex-start",
          insetInlineStart: "auto",
          // the wrapper is a large transparent box that overlaps the other
          // drawer's handle — it must never swallow clicks itself
          pointerEvents: "none",
        }}
        dir="rtl"
      >
        <button
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          aria-label={open ? "סגירת דופק הכיתה" : "פתיחת דופק הכיתה"}
          aria-expanded={open}
          className="mt-6 flex select-none flex-col items-center justify-center gap-0.5 rounded-s-xl shadow-md"
          style={{
            width: HANDLE_W,
            height: 68,
            background: "var(--accent)",
            color: "#fff",
            cursor: dragging ? "grabbing" : "grab",
            touchAction: "none",
            border: "none",
            pointerEvents: "auto",
          }}
        >
          <span style={{ fontSize: 14 }} aria-hidden>📊</span>
          <span aria-hidden style={{ width: 3, height: 22, borderRadius: 2, background: "rgba(255,255,255,0.45)" }} />
        </button>

        <aside
          aria-hidden={!open && !dragging}
          className="overflow-y-auto rounded-s-2xl border-s border-y border-[color:var(--border)] shadow-2xl"
          style={{
            width: panelW,
            maxHeight: "72vh",
            background: "var(--card)",
            boxShadow: "inset -12px 0 18px -14px rgba(46,36,56,0.35), 0 18px 45px -18px rgba(46,36,56,0.45)",
            pointerEvents: "auto",
          }}
        >
          <div className="border-b border-[color:var(--border)] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-display text-base font-bold text-[color:var(--primary)]">
                📊 דופק כיתה
              </p>
              <a
                href={`/dashboard/class-board/${taskId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full bg-[color:var(--primary)] px-3 py-1 text-[11px] font-bold text-white shadow transition hover:scale-[1.03]"
              >
                🖥️ הקרנה על הלוח
              </a>
            </div>
            {data && (
              <p className="mt-1 text-[10px] text-[color:var(--primary)]/55">
                {data.task.bookRef} · {data.task.title}
              </p>
            )}
          </div>

          {!data || !groups ? (
            <p className="p-5 text-xs text-[color:var(--foreground)]/60">טוען את מצב הכיתה...</p>
          ) : (
            <div className="space-y-4 p-4">
              <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                <span className="rounded-full bg-[color:var(--success)]/10 px-2.5 py-1 text-[color:var(--success)]">
                  🟢 עובדים עכשיו: {groups.active.length}
                </span>
                <span className="rounded-full bg-[color:var(--primary)]/10 px-2.5 py-1 text-[color:var(--primary)]">
                  ✅ הגישו: {groups.submitted.length}
                </span>
                <span className="rounded-full bg-[color:var(--danger)]/10 px-2.5 py-1 text-[color:var(--danger)]">
                  ⚪ לא נוכחים: {groups.away.length}
                </span>
              </div>

              {groups.active.length > 0 && (
                <StudentGroup title="עובדים עכשיו" students={groups.active} data={data} live />
              )}
              {groups.submitted.length > 0 && (
                <StudentGroup title="הגישו 🎉" students={groups.submitted} data={data} />
              )}
              {groups.away.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[11px] font-bold text-[color:var(--danger)]/80">
                    לא נוכחים כרגע
                  </p>
                  <ul className="space-y-1">
                    {groups.away.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-lg bg-[color:var(--background)] px-3 py-1.5 text-xs opacity-70"
                      >
                        <span>{s.name}</span>
                        <span className="text-[10px] text-[color:var(--primary)]/50">
                          {s.stage === 0
                            ? "טרם נפתחה"
                            : `${s.unitsDone}/${data.totalUnits} · לא פעיל/ה`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

function StudentGroup({
  title,
  students,
  data,
  live,
}: {
  title: string;
  students: StudentRow[];
  data: ClassStatus;
  live?: boolean;
}) {
  const sorted = [...students].sort((a, b) => b.unitsDone - a.unitsDone);
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-bold text-[color:var(--primary)]/70">{title}</p>
      <ul className="space-y-1.5">
        {sorted.map((s) => {
          const pct = Math.round((100 * s.unitsDone) / Math.max(1, data.totalUnits));
          return (
            <li key={s.id} className="rounded-xl bg-[color:var(--background)] px-3 py-2">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 font-semibold text-[color:var(--foreground)]">
                  {live && (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[color:var(--success)]" />
                    </span>
                  )}
                  {s.name}
                </span>
                <span className="text-[10px] font-bold text-[color:var(--primary)]/60">
                  {s.unitsDone}/{data.totalUnits} · {pct}%
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color:var(--border)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: pct >= 100 ? "var(--success)" : "var(--primary)",
                  }}
                />
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-[color:var(--primary)]/50">
                <span>
                  {s.stage >= 8 ? "חלק ב — העמקה ודיון" : `חלק א · שלב ${s.stage || 1} מתוך 7`}
                </span>
                <span>⏱ {Math.round(s.workSeconds / 60)} דק׳</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```
(שורת "חלק א · שלב N" — התאם למינוח של האתר היעד, או השמט אם אין שלבים.)

## 3) לוח ההקרנה (קוד מלא)

עמוד נפרד, בלי כרום. השעון מתקתק כל שנייה; הנתונים כל 4 שניות.

```tsx
// app/dashboard/class-board/[taskId]/page.tsx — teacher guard only:
import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { getTask } from "@/lib/tasks";
import ClassBoard from "@/components/class-board";

export default async function ClassBoardPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const session = await auth();
  const user = session?.user;
  if (!user) redirect("/login");
  if (user.role !== "teacher") redirect("/");
  const { taskId } = await params;
  const task = await getTask(Number(taskId));
  if (!task) notFound();
  return <ClassBoard taskId={task.id} />;
}
```

```tsx
"use client";

// The projectable class board — full-screen, beautiful, meant for the
// classroom projector: task name + chapter/sugiya, a live clock, the whole
// class as cards with per-question dots, and a big class-average bar.
// Polls every 4 seconds; the clock ticks every second.

import { useEffect, useState } from "react";

interface StudentRow {
  id: number;
  name: string;
  stage: number;
  unitsDone: number;
  doneKeys: string[];
  workSeconds: number;
  lastBeat: number | null;
  status: "active" | "idle" | "submitted" | "absent";
}

interface ClassStatus {
  task: { id: number; title: string; subtitle: string; bookRef: string; dueAt: number };
  totalUnits: number;
  units: { key: string; label: string; part: "a" | "b" }[];
  students: StudentRow[];
}

export default function ClassBoard({ taskId }: { taskId: number }) {
  const [data, setData] = useState<ClassStatus | null>(null);
  const [clock, setClock] = useState("");
  const [dateLine, setDateLine] = useState("");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/tasks/${taskId}/class-status`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (alive && d.ok) setData(d);
        })
        .catch(() => {});
    load();
    const iv = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [taskId]);

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setClock(
        new Intl.DateTimeFormat("he-IL", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "Asia/Jerusalem",
        }).format(d)
      );
      setDateLine(
        new Intl.DateTimeFormat("he-IL", { weekday: "long", timeZone: "Asia/Jerusalem" }).format(d) +
          " · " +
          new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
            day: "numeric",
            month: "long",
            timeZone: "Asia/Jerusalem",
          }).format(d)
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center text-lg text-[color:var(--primary)]/60">
        טוען את לוח הכיתה...
      </div>
    );
  }

  const present = data.students.filter((s) => s.status === "active" || s.status === "submitted");
  const away = data.students.filter((s) => s.status === "idle" || s.status === "absent");
  const classPct =
    data.students.length === 0
      ? 0
      : Math.round(
          (100 * data.students.reduce((acc, s) => acc + s.unitsDone, 0)) /
            (data.totalUnits * data.students.length)
        );
  const submittedCount = data.students.filter((s) => s.status === "submitted").length;

  return (
    <div className="min-h-screen px-8 py-6" style={{ background: "var(--background)" }}>
      {/* header */}
      <header className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="mb-2 flex items-center gap-3" aria-hidden>
            <div className="h-px w-14 bg-[color:var(--accent)]/60" />
            <div className="h-2 w-2 rotate-45 bg-[color:var(--accent)]" />
            <div className="h-px w-14 bg-[color:var(--accent)]/60" />
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight text-[color:var(--primary)]">
            {data.task.title}
          </h1>
          <p className="mt-1 text-lg text-[color:var(--accent)]">
            📖 {data.task.bookRef} · {data.task.subtitle}
          </p>
        </div>
        <div className="shrink-0 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] px-6 py-4 text-center shadow-sm">
          <p className="font-display text-4xl font-extrabold tabular-nums text-[color:var(--primary)]">
            {clock}
          </p>
          <p className="mt-1 text-sm text-[color:var(--primary)]/60">{dateLine}</p>
        </div>
      </header>

      {/* class aggregate */}
      <div className="mb-6 rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <p className="font-display text-xl font-bold text-[color:var(--primary)]">
            📊 הכיתה יחד
          </p>
          <p className="text-sm font-bold text-[color:var(--primary)]/70">
            🟢 {present.length - submittedCount} עובדים · ✅ {submittedCount} הגישו · ⚪ {away.length} לא נוכחים
          </p>
        </div>
        <div className="h-5 overflow-hidden rounded-full bg-[color:var(--border)]">
          <div
            className="flex h-full items-center justify-end rounded-full pe-2 text-[11px] font-bold text-white transition-all duration-1000"
            style={{
              width: `${Math.max(classPct, 4)}%`,
              background: "linear-gradient(270deg, var(--primary), var(--accent))",
            }}
          >
            {classPct}%
          </div>
        </div>
      </div>

      {/* student cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
        {[...data.students]
          .sort((a, b) => {
            const rank = (s: StudentRow) =>
              s.status === "submitted" ? 0 : s.status === "active" ? 1 : 2;
            return rank(a) - rank(b) || b.unitsDone - a.unitsDone;
          })
          .map((s) => {
            const pct = Math.round((100 * s.unitsDone) / Math.max(1, data.totalUnits));
            const dim = s.status === "idle" || s.status === "absent";
            const doneSet = new Set(s.doneKeys);
            return (
              <div
                key={s.id}
                className="rounded-2xl border bg-[color:var(--card)] p-4 shadow-sm transition"
                style={{
                  borderColor: s.status === "submitted" ? "var(--success)" : "var(--border)",
                  opacity: dim ? 0.45 : 1,
                }}
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="truncate font-display text-lg font-bold text-[color:var(--primary)]">
                    {s.status === "active" && (
                      <span className="relative me-1.5 inline-flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color:var(--success)] opacity-60" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[color:var(--success)]" />
                      </span>
                    )}
                    {s.name}
                  </p>
                  <span className="shrink-0 font-display text-xl font-extrabold tabular-nums text-[color:var(--primary)]">
                    {s.status === "submitted" ? "🎉" : `${pct}%`}
                  </span>
                </div>

                <div className="mb-2 h-2.5 overflow-hidden rounded-full bg-[color:var(--border)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: s.status === "submitted" ? "var(--success)" : "var(--primary)",
                    }}
                  />
                </div>

                {/* the equal-weight units, dot per question */}
                <div className="flex flex-wrap gap-1">
                  {data.units.map((u, ui) => {
                    const stageNum = u.key.startsWith("stage:")
                      ? Number(u.key.split(":")[1])
                      : null;
                    const filled =
                      stageNum != null
                        ? Math.min(Math.max(s.stage - 1, 0), 7) >= stageNum
                        : doneSet.has(u.key);
                    return (
                      <span
                        key={ui}
                        title={u.label}
                        className="inline-block rounded-full"
                        style={{
                          width: 9,
                          height: 9,
                          background: filled
                            ? u.part === "a"
                              ? "var(--accent)"
                              : "var(--primary)"
                            : "var(--border)",
                        }}
                      />
                    );
                  })}
                </div>

                <p className="mt-2 text-[11px] text-[color:var(--primary)]/55">
                  {s.status === "submitted"
                    ? "הגיש/ה את המשימה ✓"
                    : s.status === "absent" && s.stage === 0
                      ? "טרם פתח/ה את המשימה"
                      : dim
                        ? "לא נוכח/ת כרגע"
                        : s.stage >= 8
                          ? "חלק ב — העמקה ודיון"
                          : `חלק א · שלב ${s.stage || 1} מתוך 7`}
                </p>
              </div>
            );
          })}
      </div>

      <footer className="mt-6 flex items-center justify-between text-xs text-[color:var(--primary)]/45">
        <span>🟠 שלבי חלק א · 🟣 שאלות חלק ב · כל שאלה שווה בערכה</span>
        <span>מתעדכן אוטומטית כל כמה שניות</span>
      </footer>
    </div>
  );
}
```

## 4) נקודות עיגון

```tsx
// עמוד המשימה (server component), אחרי ה-TopNav:
{isTeacher && <ClassPulseDrawer taskId={taskId} />}

// עמוד המשימה בדשבורד: המגירה + כפתור גלוי ללוח:
<ClassPulseDrawer taskId={task.id} />
<Link href={`/dashboard/class-board/${taskId}`} target="_blank" className="...">
  🖥️ לוח כיתה להקרנה
</Link>
```

**חובה נלווית — הקצאה למצטרפים מאוחרים:** אם ההקצאה למשימות קורית רק ברגע
הפרסום, תלמיד שנרשם אחרי הפרסום לא יופיע בלוח לעולם. בסיום ה-onboarding יש
להקצות לו את כל המשימות הקיימות (`INSERT OR IGNORE` על טבלת ההקצאות עבור כל
משימה). בלי זה — הלוח יהיה ריק ביום הראשון של השנה.

## 5) לקחי באגים אמיתיים — חובה לשמר

1. **🐛 הבאג שכן קרה: שתי מגירות באותו צד חוסמות זו את זו.** העוטף של כל מגירה
   הוא div שקוף גדול; העוטפים חופפים אנכית, ומי שמרונדר אחרון בולע את הקליקים
   על הידית של השני. **הפתרון מחויב:** `pointerEvents: "none"` על העוטף,
   ו-`pointerEvents: "auto"` על הידית ועל הפאנל — בכל המגירות באתר (כולל
   מגירת הרפלקציה אם קיימת!).
2. **אימות אמיתי בלבד:** `element.dispatchEvent(...)` עוקף את בדיקת-הפגיעה של
   הדפדפן ולכן "מוכיח" שהמגירה עובדת גם כשהיא חסומה. לאמת עם
   `document.elementFromPoint(x, y)` בנקודת הידית + שיגור לאלמנט שנמצא שם.
3. **הקשה מול גרירה:** סף תזוזה 4px מבחין בין tap ל-drag; בלי זה כל רעד עכבר
   נחשב גרירה.
4. `touchAction: "none"` על הידית — אחרת מובייל מגלגל את הדף במקום לגרור.
5. `setPointerCapture` עטוף ב-try/catch (נכשל בחלק מהדפדפנים; הגרירה שורדת).
6. **containing block:** אלמנט fixed נכלא תחת אבא עם backdrop-filter/transform —
   אם המגירה "כלואה" בתוך ההדר, חפשו backdrop-blur אצל האבות.
7. ה-polling עם `cache: "no-store"` — בלי זה דפדפנים מגישים סטטוס ישן.
8. אין צורך ב-WebSockets: heartbeat כתיבה כל ~20 שניות + polling קריאה כל
   4–5 שניות ע"י מורה אחד — עומס זניח ותחושת "חי" מלאה.

## נספח א' — אם הסטאק שונה

הקוד מניח Next.js App Router, next-auth (`user.role === "teacher"`), Turso
libSQL ב-SQL גולמי, Tailwind v4 עם משתני CSS, RTL גלובלי. התאמות: החלף את
שכבת ה-auth וה-DB לפי האתר; ה-UI לא תלוי בכלום מלבד משתני הפלטה; ב-LTR הפוך
את כיוון הגרירה (closedX שלילי בנוי ל-RTL).

## נספח ב' — אם אין heartbeat של זמן עבודה

בצד התלמיד, בעמוד המשימה (client), שלחו דופק כל 20 שניות כשהחלון גלוי:

```ts
useEffect(() => {
  let acc = 0;
  const tick = setInterval(() => {
    if (document.visibilityState === "visible") acc += 1;
  }, 1000);
  const flush = () => {
    if (acc === 0) return;
    const seconds = acc;
    acc = 0;
    fetch(`/api/tasks/${taskId}/timer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seconds }),
    }).catch(() => {});
  };
  const flushTimer = setInterval(flush, 20000);
  return () => { clearInterval(tick); clearInterval(flushTimer); flush(); };
}, [taskId]);
```

וה-route מעדכן `work_seconds = work_seconds + ?` וגם `updated_at = now()`
(עם clamp של הדלתא ל-60 שניות כדי שלקוח תקוע לא ינפח את המונה). ה-`updated_at`
הזה הוא גלאי הנוכחות של כל הפיצ'ר.
