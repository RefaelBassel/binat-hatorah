# מצב מיקוד (Focus Mode) — מסמך העברה מלא לאתרי למידה אחרים

> **מסמך זה מיועד ל-Claude Code בפרויקט אחר.** הוא מתעד את פיצ'ר "מצב מיקוד"
> כפי שהוא בנוי, פועל ומאושר באתר "בינת התורה": מעקב קשב שקוף בזמן עבודה
> בכיתה — יציאות מחלון המשימה + חסימת הדבקות חיצוניות — עם כל השיקולים
> הפדגוגיים, סכמת ה-DB, ה-API, קוד הלקוח, וההכרעות שכבר הוכרעו. הקוד הועתק
> אחד-לאחד מהמימוש החי.
>
> **תלוי בפיצ'ר "דופק כיתה" ולוח ההקרנה** (ראו handoff-class-pulse.md) — מצב
> מיקוד מזין אותם. אם אין באתר היעד דופק כיתה — בנו אותו קודם.

---

## ‼️ פרוטוקול התאמה — לפני שורת קוד אחת

זה פיצ'ר טעון פדגוגית. אסור להעתיק עיוור.

### שלב 1 — למד את האתר
- האם קיים "דופק כיתה" + לוח הקרנה? (מצב מיקוד מוסיף אליהם שדות — לא עומד לבד.)
- האם יש heartbeat של זמן-עבודה (`updated_at` שמתעדכן כל ~20ש׳)? משמש לזיהוי
  "נוכח עכשיו" בחישוב המיקוד הכיתתי.
- מהם שדות התוכן שאפשר להדביק מהם לגיטימית (אצלנו: פסוקים ומקורות) — כי
  ההוראות שלנו עצמן אומרות "העתיקו את הפסוק", ואסור שהחסימה תשבור אותן.

### שלב 2 — הצג לרפאל את ארבע ההכרעות הפדגוגיות (הן ליבת הפיצ'ר!)
אלה הוכרעו במפורש בבינת התורה. באתר אחר — לאשר מחדש, לא להניח:

1. **מה על הלוח המוקרן?** → **מדד כיתתי מצרפי בלבד** ("🎯 מיקוד כיתתי: 92%").
   לעולם לא סימון אישי על הלוח — זו ענישה פומבית מול כל הכיתה.
2. **מה קורה בחריגה (3+ יציאות)?** → **התראה למורה (פרטי) + נדנוד עדין אחד
   לתלמיד**. לא הפחתת ציון אוטומטית, לא הורדה בדירוג הפומבי.
3. **מדיניות הדבקה?** → **לחסום טקסט חיצוני מעל 2 מילים, להתיר פסוקי/מקורות
   המשימה.**
4. **התלמיד רואה את המונה של עצמו?** → **כן, מונה שקט** (שקיפות + מודעות
   עצמית; מעקב סמוי הורס אמון כשמתגלה).

### שלב 3 — הסבר לרפאל את הכנות הטכנית (חשוב לציפיות!)
- **אפשר לזהות:** מעבר טאב/חלון, מזעור, יציאה ממסך מלא, משך הזמן בחוץ; הדבקה
  ארוכה; (בשרת) תשובה שקופצת מוכנה בלי זמן הקלדה.
- **אי אפשר:** מסך שני, טלפון, דף מודפס, או להבחין בין "פתח מחשבון" ל"פתח AI".
- **התראות-שווא מובנות:** התראת מערכת שגונבת פוקוס, Alt-Tab בטעות, ואפילו
  קישורים שאנחנו עצמנו שמנו (אצלנו "לקריאה בספריא ↗"). **לכן האות הוא ראיה
  לשיחה אנושית — לא פסק דין. אין הפחתת ציון אוטומטית, נקודה.**

**מה קבוע ולא נתון להתאמה:** אין ענישה אוטומטית; אין סימון אישי פומבי; שקיפות
מלאה לתלמיד; ומורה שעובר על משימה לא נספר.

---

## הפילוסופיה — למה זה עדין

האתר כולו בנוי על אמון ("אני עשיתי לבד אבל לא פגשתי קיר"). לוח שמסמן תלמידים
בסימני-חטא הופך כלי חם לכלי שיטור, וגורם ללמוד "כדי לא להיתפס". ההגנה
העמוקה האמיתית איננה מעקב — היא **טבע המשימה**: לשון אישית, תהליך גלוי
(סימונים, שלבים, מאגר שאלות), רפלקציה וזמן-עבודה מדוד. תלמיד עם 4 דקות עבודה
ותשובות מלוטשות מסגיר את עצמו בנתונים שכבר יש. מצב מיקוד הוא שכבה **משלימה
ומרתיעה בהוגנות**, לא התשתית.

---

## ארכיטקטורה — ארבעה חלקים

| חלק | קובץ במקור | תפקיד |
|---|---|---|
| סכמה | `migrations/0007_focus_events.sql` + `ensureFocusTable` ב-lib/tasks.ts | טבלת `focus_events` (נוצרת lazily) |
| דיווח | `app/api/tasks/[taskId]/focus/route.ts` | POST, תלמידים בלבד |
| לקוח | `components/task/task-runner.tsx` | זיהוי יציאה, מונה, נדנוד, guard הדבקה |
| מורה | class-status API + class-pulse-drawer + class-board + submission page | תצוגה מצרפית ופרטית |

## 1) סכמת ה-DB

```sql
CREATE TABLE IF NOT EXISTS focus_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,          -- 'blur' | 'paste-blocked'
  away_ms INTEGER,             -- blur only: how long outside the window
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_focus_task_user ON focus_events(task_id, user_id);
```

## 2) שכבת ה-DB (lib/tasks.ts) — קוד מלא

```ts
let focusReady = false;
export async function ensureFocusTable() {
  if (focusReady) return;
  await db().execute(
    `CREATE TABLE IF NOT EXISTS focus_events (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       task_id INTEGER NOT NULL,
       user_id INTEGER NOT NULL,
       kind TEXT NOT NULL,
       away_ms INTEGER,
       created_at INTEGER NOT NULL
     )`
  );
  await db().execute(
    "CREATE INDEX IF NOT EXISTS idx_focus_task_user ON focus_events(task_id, user_id)"
  );
  focusReady = true;
}

export async function recordFocusEvents(
  taskId: number, userId: number,
  events: { kind: "blur" | "paste-blocked"; awayMs?: number }[]
) {
  await ensureFocusTable();
  const t = now();
  for (const e of events.slice(0, 20)) {
    await db().execute({
      sql: `INSERT INTO focus_events (task_id, user_id, kind, away_ms, created_at)
            VALUES (?, ?, ?, ?, ?)`,
      args: [taskId, userId,
        e.kind === "paste-blocked" ? "paste-blocked" : "blur",
        e.kind === "blur" ? Math.min(Math.max(0, Math.round(e.awayMs ?? 0)), 3600_000) : null,
        t],
    });
  }
}

export interface FocusStats { exits: number; awayMs: number; pasteBlocked: number; }

// windowed to the current lesson (pass now - 90*60)
export async function focusStatsFor(
  taskId: number, sinceUnix?: number
): Promise<Map<number, FocusStats>> {
  await ensureFocusTable();
  const res = await db().execute({
    sql: `SELECT user_id, kind, COUNT(*) AS n, COALESCE(SUM(away_ms), 0) AS away
          FROM focus_events WHERE task_id = ? AND created_at >= ?
          GROUP BY user_id, kind`,
    args: [taskId, sinceUnix ?? 0],
  });
  const map = new Map<number, FocusStats>();
  for (const r of res.rows) {
    const uid = Number(r.user_id);
    const s = map.get(uid) ?? { exits: 0, awayMs: 0, pasteBlocked: 0 };
    if (String(r.kind) === "blur") { s.exits = Number(r.n); s.awayMs = Number(r.away); }
    else s.pasteBlocked = Number(r.n);
    map.set(uid, s);
  }
  return map;
}
```

## 3) ה-API — `app/api/tasks/[taskId]/focus/route.ts` (קוד מלא)

```ts
import { NextResponse } from "next/server";
import { requireStudentTask } from "@/lib/api-auth";
import { recordFocusEvents } from "@/lib/tasks";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const guard = await requireStudentTask(taskId);
  if (!guard.ok) return guard.res;
  if (guard.isTeacher) return NextResponse.json({ ok: true, skipped: true });

  const body = await req.json().catch(() => null);
  const events = Array.isArray(body?.events)
    ? body.events
        .filter((e: { kind?: string }) => e?.kind === "blur" || e?.kind === "paste-blocked")
        .map((e: { kind: string; awayMs?: unknown }) => ({
          kind: e.kind as "blur" | "paste-blocked",
          awayMs: Number(e.awayMs) || 0,
        }))
    : [];
  if (events.length === 0) return NextResponse.json({ ok: true });
  await recordFocusEvents(guard.task.id, guard.userId, events);
  return NextResponse.json({ ok: true });
}
```

## 4) הלקוח (task-runner.tsx) — הליבה

**State + זיהוי יציאה:** (`trackFocus = !isTeacher && !submitted`)

```ts
const trackFocus = !canReset && !submitted; // canReset === isTeacher here
const [focusExits, setFocusExits] = useState(initialFocusExits);
const [focusNudge, setFocusNudge] = useState(false);
const nudgeShown = useRef(initialFocusExits >= 3);
const awaySince = useRef<number | null>(null);

const reportFocus = (events: { kind: string; awayMs?: number }[]) => {
  try {
    navigator.sendBeacon?.(`/api/tasks/${taskId}/focus`,
      new Blob([JSON.stringify({ events })], { type: "application/json" })) ||
      fetch(`/api/tasks/${taskId}/focus`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }), keepalive: true });
  } catch { /* focus reporting must never break the task page */ }
};

useEffect(() => {
  if (!trackFocus) return;
  const onAway = () => { if (awaySince.current == null) awaySince.current = Date.now(); };
  const onBack = () => {
    if (awaySince.current == null) return;
    const awayMs = Date.now() - awaySince.current;
    awaySince.current = null;
    if (awayMs < 1500) return;             // ignore OS-toast / Alt-Tab flicker
    reportFocus([{ kind: "blur", awayMs }]);
    setFocusExits((n) => {
      const next = n + 1;
      if (next >= 3 && !nudgeShown.current) { nudgeShown.current = true; setFocusNudge(true); }
      return next;
    });
  };
  const onVisibility = () =>
    document.visibilityState === "hidden" ? onAway() : onBack();
  window.addEventListener("blur", onAway);
  window.addEventListener("focus", onBack);
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    window.removeEventListener("blur", onAway);
    window.removeEventListener("focus", onBack);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}, [trackFocus, taskId]);
```

**Guard הדבקה** (על ה-div העליון של המשימה: `onPaste={onGuardedPaste}`):

```ts
// nikud/taamim/punct/spaces all removed → a verse pasted from anywhere matches
function normalizeForPaste(s: string): string {
  return s.replace(/[֑-ׇ]/g, "").replace(/[^א-תa-zA-Z0-9]/g, "").toLowerCase();
}

// build ONCE from the task's own verses + sources + helpVerses:
const allowedCorpus = useMemo(() => {
  const parts: string[] = [];
  const addVerses = (vs: { text: string }[]) => vs.forEach((v) => parts.push(v.text));
  addVerses(mainPassage.verses);
  for (const sec of content.sections) for (const b of sec.blocks) {
    if (b.type === "passage") addVerses(b.verses);
    if (b.type === "source") parts.push(b.text);
    if (b.type === "question" && b.helpVerses) addVerses(b.helpVerses.verses);
  }
  return normalizeForPaste(parts.join(" "));
}, [content, mainPassage]);

const onGuardedPaste = (e: React.ClipboardEvent) => {
  if (!trackFocus) return;
  const target = e.target as HTMLElement;
  if (target.tagName !== "TEXTAREA" && target.tagName !== "INPUT") return;
  if (target.closest('[data-paste-free="true"]')) return; // the Claude chat panel
  const text = e.clipboardData?.getData("text") ?? "";
  if (text.trim().split(/\s+/).length <= 2) return;        // short pastes pass
  if (allowedCorpus.includes(normalizeForPaste(text))) return; // task verses pass
  e.preventDefault();
  setPasteMsg(true);
  setTimeout(() => setPasteMsg(false), 4000);
  reportFocus([{ kind: "paste-blocked" }]);
};
```

**UI:** מונה שקט בסרגל ("🎯 {focusExits} יציאות מהמשימה", מוצג רק כש>0);
טוסט נדנוד חד-פעמי ב-3; טוסט הדבקה חמה ("כאן כותבים במילים שלכם"). את פאנל
צ'אט קלוד מסמנים `data-paste-free="true"` כדי שהשיחה לא תיחסם.

**רציפות המונה על רענון:** בעמוד המשימה (server) סופרים blur מה-90 דקות
האחרונות ומעבירים כ-`initialFocusExits`.

## 5) צד המורה

**class-status API** — לכל תלמיד `focusExits`, `focusAwaySec`, `pasteBlocked`
(חלון 90 דק׳); ובנוסף `classFocusPct` = אחוז ה**נוכחים** (פעילים/הגישו) עם ≤2
יציאות. **מצרפי בלבד לרמת הכיתה.**

```ts
const focus = await focusStatsFor(task.id, t - 90 * 60);
// ...per student: focusExits/focusAwaySec/pasteBlocked from focus.get(uid)
const present = students.filter(s => s.status === "active" || s.status === "submitted");
const classFocusPct = present.length === 0 ? null
  : Math.round(100 * present.filter(s => s.focusExits <= 2).length / present.length);
```

**מגירת דופק כיתה** — badge פר-תלמיד (כתום מ-3 יציאות): `🎯 {exits} · {דק׳} בחוץ · 📋 {paste}`.
**לוח הקרנה** — רק "🎯 מיקוד כיתתי: N%" בשורת הסיכום, אף פעם לא פר-תלמיד.
**עמוד הגשה** — פאנל "תמונת מיקוד" עם **disclaimer מפורש**: "נתון רקע לשיקול
דעת ולשיחה... אין לכך השפעה אוטומטית על הציון."

## 6) לקחי מימוש — חובה לשמר

1. **סף 1.5ש׳ ליציאה** — מתחת לזה מתעלמים (התראות מערכת, Alt-Tab בטעות).
2. **מורה לא נספר** — `if (guard.isTeacher) skip` בשרת + `trackFocus` בלקוח.
3. **ה-guard על שדות תשובה בלבד** — לא על צ'אט קלוד (`data-paste-free`).
4. **פסוקי המשימה מותרים** — אחרת שוברים את ההוראה "העתיקו את הפסוק". הנרמול
   מסיר ניקוד/טעמים/פיסוק כך שפסוק מכל מקור מזוהה.
5. **דיווח לא שובר את הדף** — sendBeacon עם fallback ל-fetch, עטוף ב-try/catch.
6. **אין הפחתת ציון אוטומטית** — בשום מקום. האות = ראיה לשיחה.
7. **חלון 90 דקות** — "השיעור הנוכחי", לא כל ההיסטוריה; רציפות על רענון.
8. **הטבלה נוצרת lazily** — עובד בפרודקשן בלי הרצת מיגרציה ידנית.

## נספח — שאלות פתוחות לרפאל (העתק-הדבק אחרי שלב 1)

1. אילו סוגי תוכן מותרים להדבקה באתר הזה (מקבילות לפסוקים/מקורות)?
2. מהו חלון "השיעור" הנכון לאתר הזה (אצלנו 90 דק׳)?
3. סף הנדנוד/ההתראה — 3 יציאות מתאים, או ערך אחר?
4. האם לשמר את הניסוחים (המונה, הנדנוד, הודעת ההדבקה, ה-disclaimer) או מינוח מקומי?
