// The argumentative-writing practice space content. Short, varied, fun —
// never one long exhausting drill. Answer keys live server-side only in
// answers.ts (not shipped to the client).

export const COMPONENT_LABELS = [
  "טענה",
  "נימוק / ראיה",
  "הנחת יסוד סמויה",
  "מסקנה",
] as const;

export interface TagSentence {
  id: string;
  text: string;
}

export interface TagExercise {
  kind: "tag";
  key: string;
  title: string;
  flavor: string; // 😂 מצחיק / 🏫 מהחיים / 📜 מהתנ"ך
  why: string; // one-line pedagogical "why this matters"
  intro: string;
  sentences: TagSentence[];
}

export interface McExercise {
  kind: "mc";
  key: string;
  title: string;
  flavor: string;
  why: string;
  prompt: string;
  options: string[];
}

export interface FreeExercise {
  kind: "free";
  key: string;
  title: string;
  flavor: string;
  why: string;
  prompt: string;
  fields: { key: string; label: string; placeholder?: string }[];
}

export type WritingExercise = TagExercise | McExercise | FreeExercise;

export interface WritingLevel {
  n: number;
  title: string;
  emoji: string;
  description: string;
  exercises: WritingExercise[];
}

export const WRITING_LEVELS: WritingLevel[] = [
  {
    n: 1,
    title: "מזהים את המרכיבים",
    emoji: "🧩",
    description:
      "כל טיעון בנוי מחלקים: טענה, נימוקים/ראיות, הנחות יסוד ומסקנה. קודם לומדים לזהות אותם — גם כשהם מגיעים בסדר מבולבל.",
    exercises: [
      {
        kind: "tag",
        key: "w1-cats",
        title: "החתול המושלם",
        flavor: "😂 טיעון מצחיק",
        why: "זיהוי מרכיבים = צעד ראשון בכל חשיבה ביקורתית",
        intro: "סווגו כל משפט: איזה מרכיב של הטיעון הוא?",
        sentences: [
          { id: "s1", text: "חתולים הם חיות המחמד המושלמות." },
          { id: "s2", text: "הם מנקים את עצמם, ואף אחד לא צריך לטייל איתם בגשם." },
          { id: "s3", text: "לכן, כל משפחה בישראל צריכה לאמץ חתול עוד היום." },
        ],
      },
      {
        kind: "tag",
        key: "w1-phones",
        title: "טלפונים בבית הספר",
        flavor: "🏫 מהחיים",
        why: "בחיים האמיתיים המרכיבים מגיעים בערבוביה",
        intro:
          "שימו לב: הפעם המשפטים לא מסודרים לפי הסדר הקלאסי! סווגו כל אחד.",
        sentences: [
          { id: "s1", text: "מחקרים מראים שהריכוז יורד כשהטלפון נמצא בכיס." },
          { id: "s2", text: "תפקידו של בית הספר הוא לאפשר ריכוז מלא בלמידה." },
          { id: "s3", text: "לכן יש לאסוף את הטלפונים בתחילת כל יום לימודים." },
          { id: "s4", text: "טלפונים פוגעים בלמידה." },
        ],
      },
      {
        kind: "tag",
        key: "w1-pesach",
        title: "״לָמָּה נִגָּרַע?״",
        flavor: "📜 מהתנ״ך",
        why: "גם דמויות בתנ״ך טוענות, מנמקות ומניחות הנחות",
        intro:
          "הטמאים פונים אל משה. סווגו את מרכיבי הטיעון שלהם (שימו לב: אחד המשפטים הוא הנחה שהם לא אמרו בקול!):",
        sentences: [
          { id: "s1", text: "אֲנַחְנוּ טְמֵאִים לְנֶפֶשׁ אָדָם (נטמאנו באונס, לא באשמתנו)." },
          { id: "s2", text: "לָמָּה נִגָּרַע? — תנו גם לנו דרך להקריב את קרבן ה׳." },
          { id: "s3", text: "מי שנטמא שלא באשמתו — לא ראוי שיפסיד מצווה." },
        ],
      },
    ],
  },
  {
    n: 2,
    title: "חושפים הנחות יסוד",
    emoji: "🔍",
    description:
      "מתחת לכל טיעון מסתתרות הנחות שלא נאמרות בקול. מי שחושפים אותן — מבינים את הטיעון באמת.",
    exercises: [
      {
        kind: "mc",
        key: "w2-homework",
        title: "לבטל שיעורי בית?",
        flavor: "🏫 מהחיים",
        why: "ההנחה הסמויה היא הלב הנסתר של הטיעון",
        prompt:
          "״צריך לבטל שיעורי בית, כי ילדים צריכים לנוח אחרי יום לימודים ארוך.״ — מהי הנחת היסוד הסמויה של הטיעון?",
        options: [
          "המנוחה אחרי הלימודים חשובה יותר מהתרגול הנוסף שבשיעורי הבית",
          "המורים נותנים יותר מדי שיעורי בית",
          "ילדים לא אוהבים להכין שיעורי בית",
          "יום הלימודים מסתיים מאוחר מדי",
        ],
      },
      {
        kind: "free",
        key: "w2-takdim",
        title: "התקדים המסוכן",
        flavor: "🏫 מהדילמה שלנו",
        why: "חשיפת הנחה = היכולת לערער עליה",
        prompt:
          "בדילמת הרובוטיקה, ההנהלה טענה: ״אם נחריג אתכם, ייגרם תקדים מסוכן והסדר ייפגע.״ נסו לחשוף: איזו הנחת יסוד סמויה עומדת מאחורי הטענה הזו? (רמז: מה ההנהלה מניחה שיקרה אם עושים חריגה אחת?)",
        fields: [
          {
            key: "assumption",
            label: "הנחת היסוד הסמויה של ההנהלה",
            placeholder: "ההנהלה מניחה ש...",
          },
        ],
      },
    ],
  },
  {
    n: 3,
    title: "חוזקות וחולשות",
    emoji: "💪",
    description:
      "טיעון יכול להיחלש בכל מרכיב: הנחת יסוד רעועה, ראיה חלשה, או מסקנה שלא נובעת לוגית. לומדים לאתר בדיוק איפה.",
    exercises: [
      {
        kind: "mc",
        key: "w3-falafel",
        title: "הפלאפל של דודי",
        flavor: "😂 טיעון מצחיק",
        why: "לאתר את החולשה המדויקת — לא רק 'לא מסכימה'",
        prompt:
          "״כל מי שטעם את הפלאפל של דודי אמר שהוא טעים. לכן, הפלאפל של דודי הוא הכי טעים בעיר.״ — איפה בדיוק החולשה?",
        options: [
          "בראיה ובמסקנה: מדגם של מרוצים בלבד לא משווה לשאר העיר — המסקנה קופצת רחוק מדי",
          "בטענה: לא ברור על איזה פלאפל מדובר",
          "אין חולשה — הטיעון מצוין",
          "בהנחת היסוד: אסור בכלל להשוות אוכל",
        ],
      },
      {
        kind: "free",
        key: "w3-hanhala",
        title: "שופטים את ההנהלה",
        flavor: "🏫 מהדילמה שלנו",
        why: "הערכה הוגנת רואה גם חוזק וגם חולשה",
        prompt:
          "טיעון ההנהלה: ״התקנון תקף לכולם. אם נחריג אתכם ייגרם תקדים מסוכן, ולכן איננו מחריגים.״ — כתבו: מה החזק בטיעון הזה, ומה החלש בו? (התייחסי למרכיבים: הנחות, נימוק, מסקנה)",
        fields: [
          { key: "strong", label: "💪 החוזק של הטיעון" },
          { key: "weak", label: "🕳️ החולשה של הטיעון" },
        ],
      },
    ],
  },
  {
    n: 4,
    title: "כותבים בעצמנו",
    emoji: "✍️",
    description:
      "עכשיו תורך: בונים טיעון שלם — טענה, נימוק, הנחת יסוד גלויה ומסקנה. זו המיומנות שתלווה אותך בתוצרים, בדיבייט ובחיים.",
    exercises: [
      {
        kind: "free",
        key: "w4-fun",
        title: "הטיעון שלי — נושא כיף",
        flavor: "🎈 בחירה חופשית",
        why: "טיעון בנוי היטב משכנע יותר מעשר צעקות",
        prompt:
          "בחרו נושא קליל שחשוב לכם באמת (למשל: למה ראוי להאריך את ההפסקה הגדולה / למה כדאי לישון עם גרביים) ובנו טיעון שלם:",
        fields: [
          { key: "claim", label: "📌 הטענה שלי (השורה התחתונה)" },
          { key: "reason", label: "🧱 נימוק / ראיה" },
          { key: "assumption", label: "🔍 הנחת יסוד שאני מוכנה להגיד בקול" },
          { key: "conclusion", label: "✅ המסקנה" },
        ],
      },
      {
        kind: "free",
        key: "w4-moshe",
        title: "״עִמְדוּ וְאֶשְׁמְעָה״ — בעד או נגד",
        flavor: "📜 מהתנ״ך",
        why: "טיעון על מקור מחייב ראיות מהכתוב",
        prompt:
          "משה בחר לעצור ולשאול את ה׳ במקום להשיב מיד לטמאים. בנו טיעון בעד או נגד ההחלטה הזו כדרך מנהיגות — עם נימוק אחד לפחות מהפסוקים עצמם:",
        fields: [
          { key: "claim", label: "📌 הטענה שלי" },
          { key: "reason", label: "🧱 נימוק מהפסוקים (צטטו או תארו)" },
          { key: "conclusion", label: "✅ המסקנה שלי על מנהיגות" },
        ],
      },
    ],
  },
];

export function findExercise(key: string): WritingExercise | null {
  for (const level of WRITING_LEVELS) {
    const ex = level.exercises.find((e) => e.key === key);
    if (ex) return ex;
  }
  return null;
}

export function levelOf(key: string): WritingLevel | null {
  return WRITING_LEVELS.find((l) => l.exercises.some((e) => e.key === key)) ?? null;
}
