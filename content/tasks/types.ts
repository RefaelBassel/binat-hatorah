// Content model for learning tasks. Content is static TypeScript (like
// gemara10's /content) — the DB stores only assignments and student work.

// A single word inside an interactive passage. Words are the unit of
// marking (מילה מנחה / מילה קשה / שאלה).
export interface PassageVerse {
  num: string; // Hebrew verse number, e.g. "ו"
  text: string; // full verse text with nikud; split to words at runtime
}

export type BlockType =
  | "intro"
  | "passage"
  | "source"
  | "question"
  | "case" // דילמה/מקרה — styled callout
  | "art"; // illustrated scene between texts/questions (standing rule: every task)

export interface IntroBlock {
  type: "intro";
  key: string;
  title?: string;
  body: string;
}

// Interactive biblical text — the heart of the pshat-decoding engine.
export interface PassageBlock {
  type: "passage";
  key: string;
  ref: string; // e.g. 'במדבר ט׳, ו׳–ח׳'
  verses: PassageVerse[];
  // The main decode passage runs the full 8-stage flow; secondary passages
  // are still markable but don't drive the stage rail.
  decode?: boolean;
  // Sefaria ref for hyper-linking (curriculum chapters only), e.g. 'Numbers.9.1-8'
  sefariaRef?: string;
}

// A commentary/source quote (רש"י, ספר החינוך...). Also markable for questions.
export interface SourceBlock {
  type: "source";
  key: string;
  title: string; // e.g. 'רש"י (פסוק א׳)'
  text: string;
  // Sefaria ref for hyper-linking (curriculum commentators only),
  // e.g. 'Rashi_on_Numbers.9.1.1'
  sefariaRef?: string;
}

export type QuestionIcon = "thinking" | "argument" | "reading" | "leadership";

export interface QuestionBlock {
  type: "question";
  key: string; // stable key for the answer row
  icon: QuestionIcon; // 💡 חשיבה עצמאית / ⚖️ מיומנות הטיעון / 📖 קריאה והבנה / 👑 מנהיגות
  label: string; // section label shown above the prompt
  prompt: string;
  helper?: string; // small helper line (e.g. עזר: השתמשו במילת שאלה...)
  fields?: { key: string; label: string }[]; // multi-field questions (מתי/היכן)
  minWords?: number; // soft minimum for progress counting
}

export interface CaseBlock {
  type: "case";
  key: string;
  title: string;
  body: string;
}

// An illustrated SVG scene from components/task/task-art.tsx — the visual
// breathers teenagers need, always relevant to the chapter's content.
export interface ArtBlock {
  type: "art";
  key: string;
  art: string; // scene name in the TaskArt library
  caption?: string;
}

export type TaskBlock =
  | IntroBlock
  | PassageBlock
  | SourceBlock
  | QuestionBlock
  | CaseBlock
  | ArtBlock;

export interface TaskSection {
  key: string;
  title: string;
  minutes?: number; // suggested duration, shown as a chip
  blocks: TaskBlock[];
}

// Config for the 7 fixed pshat-decoding stages on the main passage (Part A).
export interface DecodeConfig {
  passageKey: string; // which passage block is the main decode text
  // Genre options offered in the genre stage
  genreOptions: string[];
  expectedGenre?: string;
  // Leitwort candidate families prepared as a thinking aid for Claude only —
  // NOT teacher-defined and never a closed list; any well-reasoned candidate
  // meeting the literary criteria is legitimate.
  expectedLeitwort?: string[];
  // Whether the passage has a תקבולת (opens the tool regardless of genre).
  hasParallelism: boolean;
  minQuestions: number; // question stage: minimum questions to formulate
}

export interface TaskContent {
  ref: string; // registry key, e.g. 'lesson-01'
  title: string;
  subtitle?: string;
  bookRef: string; // e.g. 'חומש במדבר, פרק ט׳ (פסוקים א׳–י״ד)'
  skill: string; // e.g. 'זיהוי ובניית טיעון (טענה, נימוק וביסוס)'
  decode: DecodeConfig;
  // Opening illustration shown in stage 1 (מפגש ראשון) — sets the scene.
  heroArt?: { art: string; caption?: string };
  // Part A stage 7 (בדיקת הבנה): VERY simple pshat comprehension questions —
  // answered from the passage alone, no commentators.
  comprehension: { key: string; prompt: string }[];
  // Part B (העמקה ודיון): the argumentative-writing + deepening worksheet.
  sections: TaskSection[];
}
