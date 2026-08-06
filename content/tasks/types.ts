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
  | "case"; // דילמה/מקרה — styled callout

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

export type TaskBlock =
  | IntroBlock
  | PassageBlock
  | SourceBlock
  | QuestionBlock
  | CaseBlock;

export interface TaskSection {
  key: string;
  title: string;
  minutes?: number; // suggested duration, shown as a chip
  blocks: TaskBlock[];
}

// Config for the 8 fixed pshat-decoding stages on the main passage.
export interface DecodeConfig {
  passageKey: string; // which passage block is the main decode text
  // Genre options offered in stage 5 (אפיון סוגה)
  genreOptions: string[];
  expectedGenre?: string;
  // Words (by exact text match) the teacher considers the leitwort family.
  // Alternative student choices with good reasoning are legitimate.
  expectedLeitwort?: string[];
  // Whether a תקבולת is present in this passage (stage 4 adapts).
  hasParallelism: boolean;
  minQuestions: number; // stage 6: minimum questions to formulate
}

export interface TaskContent {
  ref: string; // registry key, e.g. 'lesson-01'
  title: string;
  subtitle?: string;
  bookRef: string; // e.g. 'חומש במדבר, פרק ט׳ (פסוקים א׳–י״ד)'
  skill: string; // e.g. 'זיהוי ובניית טיעון (טענה, נימוק וביסוס)'
  decode: DecodeConfig;
  sections: TaskSection[];
}
