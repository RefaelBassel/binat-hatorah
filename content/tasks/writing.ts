import type { TaskContent, PassageBlock, TaskSection } from "./types";
import { ESSAY_EXERCISES, type EssayExercise } from "../writing/essays";

// Argumentative-writing practices as ordinary TASKS: the teacher publishes
// them from the dashboard like any unit (due date and time, whole class),
// they show in the students' task list, the class pulse, the submissions
// and the grading. What differs is the screen: components/writing/
// essay-runner.tsx runs the 40-minute flow instead of the pshat-decode
// stages. The answers live in the same Part-B question model, so every
// teacher view of answers works unchanged.

export function writingSections(ex: EssayExercise): TaskSection[] {
  return [
    {
      key: "analyze",
      title: "הטקסט מול העיניים — מפרקים את הטיעון",
      minutes: 6,
      blocks: [
        {
          type: "question",
          key: "q-analyze",
          icon: "reading",
          label: "קריאה והבנה",
          prompt: "מה הטקסט טוען? נסחו במילים שלכם, לא בציטוט.",
          fields: [
            { key: "claim", label: "📌 הטענה המרכזית של הכותב/ת" },
            { key: "reasons", label: "🧱 שני הנימוקים הכי חזקים בטקסט" },
            { key: "assumption", label: "🔍 הנחת יסוד סמויה אחת" },
          ],
        },
      ],
    },
    {
      key: "stand",
      title: "העמדה שלי",
      minutes: 3,
      blocks: [
        {
          type: "question",
          key: "q-stand",
          icon: "argument",
          label: "מיומנות הטיעון",
          prompt: ex.question,
          fields: [
            { key: "stand", label: "הצד שבחרתי" },
            { key: "claim", label: "📌 הטענה שלי במשפט אחד" },
          ],
        },
      ],
    },
    {
      key: "build",
      title: "בונים את הטיעון",
      minutes: 9,
      blocks: [
        {
          type: "question",
          key: "q-build",
          icon: "argument",
          label: "מיומנות הטיעון",
          prompt: "שני נימוקים, ולכל טענה ראיה: אחת מהטקסט ואחת מהחיים.",
          fields: [
            { key: "reason1", label: "🧱 נימוק ראשון" },
            { key: "reason2", label: "🧱 נימוק שני" },
            { key: "evidenceText", label: "📖 ראיה מהטקסט (ציטוט קצר + מה הוא מוכיח, או מה הוא מפספס)" },
            { key: "evidenceLife", label: "🌍 ראיה מהחיים (דוגמה ספציפית)" },
          ],
        },
      ],
    },
    {
      key: "counter",
      title: "הצד השני",
      minutes: 5,
      blocks: [
        {
          type: "question",
          key: "q-counter",
          icon: "thinking",
          label: "חשיבה עצמאית",
          prompt: "הטענה הכי חזקה של מי שחושב הפוך — ומה אתם עונים לה.",
          fields: [
            { key: "counter", label: "🥊 הטענה הכי חזקה של הצד השני" },
            { key: "rebuttal", label: "↩️ התשובה שלי לה" },
          ],
        },
      ],
    },
    {
      key: "write",
      title: "הפסקה השלמה",
      minutes: 10,
      blocks: [
        {
          type: "question",
          key: "q-essay",
          icon: "argument",
          label: "כתיבה טיעונית",
          prompt: `פסקת טיעון שלמה על השאלה: ${ex.question}`,
          helper: "פתיחה בטענה · נימוק ראשון עם ראיה · נימוק שני עם ראיה · הצד השני ותשובה · משפט סיום שחוזר לטענה",
          minWords: ex.minWords,
        },
      ],
    },
  ];
}

export function writingTask(ex: EssayExercise, order: number): { content: TaskContent; mainPassage: PassageBlock } {
  const mainPassage: PassageBlock = {
    type: "passage",
    key: "main",
    ref: ex.source.title,
    decode: false,
    verses: ex.source.paragraphs.map((p, i) => ({ num: String(i + 1), text: p })),
  };
  const content: TaskContent = {
    ref: ex.key,
    title: `תרגול כתיבה ${order} · ${ex.title}`,
    subtitle: ex.question,
    bookRef: `תרגול כתיבה טיעונית · כ־${ex.minutes} דקות · לא תלוי בפרקים`,
    skill: "כתיבה טיעונית: טענה, נימוקים, ראיות, התמודדות עם הצד השני",
    decode: { passageKey: "main", genreOptions: [], hasParallelism: false, minQuestions: 0 },
    comprehension: [],
    sections: writingSections(ex),
    writing: ex,
  };
  return { content, mainPassage };
}

export const WRITING_TASKS = Object.fromEntries(
  ESSAY_EXERCISES.map((ex, i) => [ex.key, writingTask(ex, i + 1)])
) as Record<string, { content: TaskContent; mainPassage: PassageBlock }>;

// the answer keys of a writing task, in order — for progress and hints
export function writingAnswerKeys(ex: EssayExercise): string[] {
  const keys: string[] = [];
  for (const s of writingSections(ex)) {
    for (const b of s.blocks) {
      if (b.type !== "question") continue;
      if (b.fields?.length) for (const f of b.fields) keys.push(`${b.key}:${f.key}`);
      else keys.push(b.key);
    }
  }
  return keys;
}
