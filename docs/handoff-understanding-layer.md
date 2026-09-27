# Handoff — שכבת ההבנה: צ'ק הבנה, דופק הבנה, מסך סגירה, אור פותח, עורך תוכן למורה

מסמך זה נכתב בבינת התורה (`C:\Users\User\Documents\tanach`, כיתה י) ומיועד לצ'אט של אתר
אחות (קדושים תהיו — כיתה ט, `C:\Users\User\Documents\leviticus`; או בינת התלמוד). הוא מתאר
**קוד קיים ומאומת** — לא רעיון. כל קובץ שמוזכר קיים בבינת התורה, ואפשר להעתיק אותו כמעט
כמות שהוא. ההתאמות הידועות לכיתה ט מרוכזות בסוף.

**לפני שמתחילים:** להציג לרפאל תוכנית קצרה, להציע התאמות משלך, ולשאול את השאלות הפתוחות
שבסוף. לא לבנות לפני אישור (כלל 1 ו-4 ב-CLAUDE.md).

---

## 1. למה זה קיים — העיקרון הפדגוגי (לא לוותר עליו)

המורה (ריעות) חששה שהאתר מייתר אותה ושאחרי משימות היא לא יודעת מה מצב ההבנה. הפתרון
שגובש ואושר:

- **מהלך שיעור עם פתיחה וסגירה מובלות-מורה**, ובאמצע עבודה באתר.
- **וידוא הבנה מיידי וודאי**: שאלות סגורות שהמחשב בודק → מספר 1-10 **נפרד מציון המשימה**,
  חי אצל המורה. שאלה פתוחה אחת "לגיוון" שאינה נכנסת למספר.
- **דופק הבנה**: לכל תלמיד/ה תג 1-10, ולכיתה "היכן מתקשים" — רשימת חלקי הפרק שהצבע שלהם
  **מתכהה לאדום** ככל שיותר טעו. **אין סף ואין החלטה אוטומטית** — הצבע מושך את העין, המורה
  מחליטה.
- **מסך סגירה**: שני הכיוונים מוכנים ביד זה לצד זה — לחזור על החלק החלש (עם עזר-חזרה
  שקלוד כותב **למורה**, לא לתלמידים) או שאלת המליאה. לעולם לא רגע ריק.
- **שאלת המליאה**: ל-AI אין נגיעה בה. לתלמידים היא מופיעה רק ככרטיס "💭 שאלה למחשבה" אחרי
  חלק ב — בלי שדה תשובה, בלי כפתור עזרה, בלי ציון, ובלי המילה "דיון" (כי אולי המורה תבחר
  לחזור על החומר).
- **אור פותח**: מצגת פתיחה של 4 שקפים למורה (כותרת → שאלה לפתיחה → לחשוב על → שאלת
  המליאה "נחזור לזה בסוף").
- **הכל ניתן לעריכה על ידי המורה, במקום** (כפתור ✏️ ליד כל פריט, רק למורה, מוחלט בשרת),
  עם כפתור שמירה שמרגישים שהוא עובד (מצבים: אין שינויים / יש שינויים / שומר / נשמר ✓).

---

## 2. מודל התוכן — `content/tasks/types.ts`

```ts
export type CheckKind = "choice" | "truefalse" | "order";
export interface CheckQuestion {
  key: string; kind: CheckKind; prompt: string;
  part: string;          // "פסוק ז׳ — משמעות ״נִגָּרַע״" ← מצטבר למפת החום
  options: string[];     // choice: האפשרויות; truefalse: ["נכון","לא נכון"]; order: בסדר הנכון
  answer: number;        // choice: אינדקס הנכונה; truefalse: 0|1; order: 0
}
export interface CheckOpenQuestion { key: string; prompt: string }
export interface PlenaryQuestion { question: string }
export interface OpeningDeck { opener: string; hook?: string }
export interface EditableTaskContent { check; checkOpen?; plenary; opening }
export interface TaskContent extends Partial<EditableTaskContent> { ...; comprehension: legacy }
```
- שלב 7 הקיים ("בדיקת הבנה") **הופך** לצ'ק כשיש `check`; אחרת נשאר הישן (`comprehension`).
- `countTaskUnits` (registry.ts): הצ'ק = יחידת התקדמות אחת.
- דוגמת תוכן מלאה: `content/tasks/lesson-01.ts` (5 סגורות: 3 רב-ברירה, 1 נכון/לא נכון,
  1 סידור; פתוחה; מליאה; פתיחה).

## 3. עריכה במקום — `lib/content-overrides.ts` + `app/api/content-overrides/route.ts`

- טבלה `task_content_overrides (content_ref, field, value_json, updated_at, updated_by)`,
  מפתח `(content_ref, field)`. **קבצי התוכן הם ברירת מחדל; מה שנשמר כאן גובר.**
- `effectiveContent(content)` = קובץ + עריכות. **כל דף שמציג תוכן חייב להשתמש בו**
  (task page, class-status, check route, close, opening, content hub).
- `PUT /api/content-overrides` `{contentRef, field, value}` או `{..., reset: true}`.
  `sanitizeField` מאמת בשרת (מפתחות ייחודיים, ≥2 אפשרויות, תשובה בטווח).
- קומפוננטת השמירה המשותפת: `components/save-button.tsx` (+ keyframes `save-*` ב-globals.css).
  **חובה להשתמש בה בכל עורך** — זו דרישה מפורשת של רפאל.
- העורכים: `components/task/check-editor.tsx` (שאלות סגורות + פתוחה, הוספה/מחיקה/סידור/סימון
  נכונה, "↺ לנוסח המקורי"), `PlenaryEditor` ב-`components/task/thinking-card.tsx`,
  `OpeningEditor` ב-`components/opening-deck.tsx`.
- **איפה מופיע ✏️:** בשלב 7 של המשימה (רק `canEditContent = מורה && לא במצב-תלמיד`),
  בכרטיס השאלה למחשבה, במסך הסגירה, בסרגל המצגת, וב-`/dashboard/content/[ref]` (הכל יחד).

## 4. הצ'ק — `lib/check.ts` + `app/api/tasks/[taskId]/check/route.ts` + `components/task/comprehension-check.tsx`

- טבלה `check_results (task_id, user_id, score 0-10, correct, total, answers_json, open_answer, submitted_at)`,
  מפתח `(task_id, user_id)` — **ניסיון אחד**. איפוס מורה (`reset/route.ts`) מוחק גם אותה.
- **מפתח התשובות לא מגיע לדפדפן לעולם:** `publicCheck(questions, seed)` מסיר `answer`
  ומערבב את אפשרויות ה-order (ערבוב דטרמיניסטי לפי תלמיד+משימה, לעולם לא הסדר הנכון).
  התלמיד שולח ל-order את **הטקסטים** בסדר שבחר; `scoreCheck` משווה למקור.
- הציון: `round(10 * correct / total)`. ה-route מחזיר `results: {key: boolean}` — נכון/לא,
  **בלי** התשובה הנכונה (שלא ילחשו לשכן). מורה שעוברת את המשימה מקבלת ציון בלי שמירה.
- UI: רדיו לרב-ברירה ונכון/לא נכון; צ'יפים ממוספרים בלחיצה לסידור; textarea לפתוחה עם
  שומר ההדבקה הקיים; כפתור "לבדוק ✓" נדלק רק כשהכל מלא; אחרי הבדיקה: באנר
  "ההבנה שלך: N/10" + ✓/✗ לכל שאלה + הכפתור לחלק ב נפתח. רענון שומר את המצב.
- הגייט בשלב 7 (`task-runner.tsx`): `stage7Blocked = hasCheck ? checkResult == null : (legacy)`.
- ב-`app/tasks/[taskId]/page.tsx`: `effectiveContent`, `publicCheck`, `getCheckResult`,
  `canEditContent`, `editableCheck` (המלא — רק למורה), `plenary`.

## 5. דופק הבנה — `class-status/route.ts` + `components/understanding-heat.tsx`

- `classCheckPicture(taskId)` → `scores` לכל תלמיד, `average`, `weakSpots[{part, wrong, answered, wrongPct}]`
  ממוינים מהקשה לקל.
- ה-API מוסיף: לכל תלמיד `checkScore`; ברמת הכיתה `hasCheck, classCheckAvg, checkCount, weakSpots`;
  יחידת ההתקדמות `"check"`.
- `understanding-heat.tsx`: `ScoreBadge` (ירוק ≥8, ענבר 5-7, אדום <5) ו-`UnderstandingHeat`
  (רשימת החלקים; `heatStyle(wrongPct)` — רקע שמתכהה רציף לפי האחוז). **אין סף.**
- מגירה (`class-pulse-drawer.tsx`): תג לכל תלמיד + רשימת "היכן הכיתה מתקשה" + קישורים
  למסך הסגירה ולאור פותח. לוח מוקרן (`class-board.tsx`): **ממוצע ורשימת חום בלבד, בלי ציונים
  אישיים** — החלטה מכוונת (חשיפה על מסך ענק).

## 6. מסך סגירה — `app/dashboard/close/[taskId]/page.tsx` + `components/closing-console.tsx` + `app/api/tasks/[taskId]/review-aid/route.ts`

- למורה בלבד, בלי כרום. פס סיכום עליון בצבע החלק החלש ביותר ("67% מהכיתה התקשו ב: …").
- שני כרטיסים: 🔁 חזרה (רשימת החום + "✨ להכין עזר-חזרה" + "להקרין את הפסוקים") ·
  💬 מליאה (השאלה + ✏️ + השאלות שהתלמידים שאלו מ-`question_bank` עם שמות + "להקרין").
- `review-aid`: פרומפט למורה — בדיוק ארבע שורות עם תוויות "הפסוק:", "הקריאה השגויה
  הסבירה:", "זווית מבהירה:", "שאלה לכיתה:"; פשט בלבד; ≤90 מילים; מטמון 10 דקות לפי
  משימה+תמונת הטעויות. משתמש ב-`CLAUDE_MODEL` מ-`lib/claude.ts`.
- הקרנה: שכבת מסך מלא בתוך הדף (שאלה ענקית / הפסוקים + שם החלק). Esc סוגר הקרנה, ואז יוצא.
- הכרטיס לתלמיד: `components/task/thinking-card.tsx`, מרונדר ב-`task-runner.tsx` לפני בלוק
  ההגשה רק כשהתלמיד בתת-המשימה האחרונה או אחרי הגשה.

## 7. אור פותח — `app/dashboard/opening/[taskId]/page.tsx` + `components/opening-deck.tsx`

- מנוע השקפים הועבר מ-`zoo-research/src/components/unit/deck/` (SlideDeck + primitives), CSS
  בלבד (keyframes `deck-fade/pop/float/pan/bounce` ב-globals.css), בצבעי האתר.
- `buildOpeningSlides({title, subtitle, bookRef, opening, plenary})` → 4 שקפים (שקף "לחשוב על"
  רק אם יש hook; שקף המליאה רק אם יש שאלה).
- ניווט RTL: ArrowLeft/רווח/Enter/לחיצה = הבא; ArrowRight = הקודם; Home/End; Esc; ⛶ מסך
  מלא; החלקת מגע; נקודות התקדמות. ✏️ בסרגל פותח את `OpeningEditor` במקום השקפים.

## 8. מרכז התוכן — `app/dashboard/content/page.tsx` + `[ref]/page.tsx`

- רשימת כל השיעורים בספרייה עם תגי מצב (צ'ק · N שאלות / פתוחה / מליאה / פתיחה / ✏️ נערך
  ידנית) ועמוד לכל שיעור עם שלושת העורכים + קישורים לתצוגות. קישור מהדשבורד.

## 9. מיגרציה

`migrations/0008_check_and_overrides.sql`. בבינת התורה הטבלאות נוצרות גם עצל בקוד
(`ensureCheckTable`, `ensureOverridesTable`). **באתר של כיתה ט אין יצירה עצלה** — להריץ
migrate מול הייצור ולהגיד לרפאל.

---

## 10. התאמות ידועות לכיתה ט (קדושים תהיו) — לבדוק כל אחת עם רפאל

1. **אין חלק א׳ במשימות `mode: "simple"`** (`SIMPLE_STAGES = []`, השלב קופץ 1→8). הצ'ק לא
   יכול לשבת "בין הפענוח לכתיבה". תשובת ריעות/רפאל נדרשת: הצ'ק **פותח** את דף העבודה
   (הנטייה שלנו — הקריאה הרגע קרתה בכיתה עם תנ"ך פיזי) או **סוגר** אותו. כל קוד חייב לבדוק
   `stagesFor(content).length` ולא להניח 7 שלבים.
2. **סוגי שאלות נוספים לצ'ק:** טעמי המקרא (רק אתנחתא=פסיק, סוף פסוק=נקודה — לא לשיים
   טעמים אחרים) והתמצאות בתנ"ך. אפשר לממש כ-`choice` רגיל; אם רוצים "לחצו על המילה עם
   האתנחתא" — זה `kind` חדש ודורש תכנון. **התוכן מריעות.**
3. **סינון לפי כיתה (ט1/ט2):** יש שדה כיתה ב-onboarding. דופק ההבנה, "היכן מתקשים", מסך
   הסגירה והלוח חייבים להיות מסוננים לכיתה שבשיעור. לבדוק אם `class-status` הקיים כבר
   מסנן; אם לא — זו התאמה גם לפיצ'ר הקיים. לשאול איך המורה בוחרת כיתה.
4. **טקסט מקראי עם טעמים ב-David Libre (`.font-mikra`)** — כל הצגת פסוק בצ'ק/בהקרנה/במצגת
   משתמשת בו ומכבדת את מתגי הטעמים. הנרמול של שומר ההדבקה חייב להוריד גם טעמים
   (`[\u0591-\u05AF]`).
5. **כינוי גוף:** `addressInstruction(user.addressForm)` בכל פרומפט חדש — כולל עזר-החזרה אם
   הוא מזכיר תלמידים.
6. **אין חלק טיעוני** — שאלת המליאה נגזרת מהדילמה של דף העבודה, לא מ"מיומנות הטיעון".
7. **מימדי הרפלקציה שונים** (`0003_reflections.sql`): מד-ההבנה החדש אינו רפלקציה ולא נכנס
   לשם.
8. **מנוע השקפים:** אין `zoo-research` בסביבת העבודה שלך בהכרח — להעתיק את
   `components/opening-deck.tsx` מבינת התורה כפי שהוא (הוא עצמאי).

## 11. שאלות שחובה לשאול את רפאל לפני שמתחילים

- [ ] הצ'ק פותח או סוגר את דף העבודה במשימות simple?
- [ ] אילו סוגי שאלות (טעמים/התמצאות) ומי כותב את התוכן — לקבל דוגמה אחת לפחות מריעות.
- [ ] איך בוחרים כיתה בדופק/בלוח/במסך הסגירה? האם הקיים כבר מסנן?
- [ ] האם להעתיק גם את מרכז התוכן (`/dashboard/content`) — כן, מומלץ.
- [ ] תזכורת: אחרי המיזוג — `node scripts/migrate.mjs` מול הייצור.
