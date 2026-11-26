import { db } from "./db";

// The "what we learned from marking the previous exam" box (issue #65): one
// shared box shown at the top of every published prep sheet / study guide and
// on their print page — so future prep sheets get it automatically. The
// defaults below are the teacher's wording; edits made in the exams editor are
// stored in one row and win over the defaults.

export interface ExamTips {
  title: string;
  items: string[];
}

export const DEFAULT_EXAM_TIPS: ExamTips = {
  title: "מה למדנו מבדיקת המבחן הקודם, לפני שעונים על שאלה",
  items: [
    "כתבו תשובות מלאות. אל תסמכו על כך שמי שבודק את המבחן יודע את החומר. כתבו כאילו הבודק לא למד את הפרק: הסבירו, פרטו והביאו ראיה.",
    "קראו את כל חלקי השאלה, וסמנו כל חלק (א, ב, ג... או כל ״הסבר״, ״הבא ראיה״, ״השווה״). כך תוודאו שלא פספסתם אף חלק.",
    "אם בשאלה מופיעים פסוקים, קראו אותם. התשובה נמצאת בהם בדרך כלל, וכדאי לצטט מהם.",
  ],
};

let ready = false;
async function ensureTable() {
  if (ready) return;
  await db().execute(
    `CREATE TABLE IF NOT EXISTS exam_tips (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL,
      items_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`
  );
  ready = true;
}

export function cleanTips(raw: unknown): ExamTips {
  const r = (raw ?? {}) as { title?: unknown; items?: unknown };
  const title = String(r.title ?? "").trim().slice(0, 200);
  const items = Array.isArray(r.items)
    ? r.items.map((x) => String(x ?? "").trim().slice(0, 1500)).filter(Boolean).slice(0, 20)
    : [];
  return { title, items };
}

export async function getExamTips(): Promise<ExamTips> {
  try {
    await ensureTable();
    const res = await db().execute("SELECT title, items_json FROM exam_tips WHERE id = 1");
    const row = res.rows[0];
    if (!row) return DEFAULT_EXAM_TIPS;
    return cleanTips({ title: row.title, items: JSON.parse(String(row.items_json)) });
  } catch (e) {
    console.error("exam tips failed", e);
    return DEFAULT_EXAM_TIPS;
  }
}

// An empty list hides the box (the teacher removed all the tips).
export async function saveExamTips(tips: ExamTips) {
  await ensureTable();
  const t = Math.floor(Date.now() / 1000);
  await db().execute({
    sql: `INSERT INTO exam_tips (id, title, items_json, updated_at) VALUES (1, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET title = excluded.title, items_json = excluded.items_json, updated_at = excluded.updated_at`,
    args: [tips.title, JSON.stringify(tips.items), t],
  });
}
