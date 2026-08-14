import type { TaskContent, PassageBlock } from "./types";
import { lesson01, lesson01MainPassage } from "./lesson-01";
import { lesson02, lesson02MainPassage } from "./lesson-02";
import { lesson03, lesson03MainPassage } from "./lesson-03";
import { lesson04, lesson04MainPassage } from "./lesson-04";
import { lesson05, lesson05MainPassage } from "./lesson-05";
import { lesson06, lesson06MainPassage } from "./lesson-06";
import { lesson07, lesson07MainPassage } from "./lesson-07";
import { lesson08, lesson08MainPassage } from "./lesson-08";
import { lesson09, lesson09MainPassage } from "./lesson-09";
import { lesson10, lesson10MainPassage } from "./lesson-10";
import { lesson11, lesson11MainPassage } from "./lesson-11";
import { lesson12, lesson12MainPassage } from "./lesson-12";
import { lesson13, lesson13MainPassage } from "./lesson-13";

// Registry of task content, keyed by content_ref stored on the tasks table.
// The teacher publishes a task by picking a ref from here.
export interface RegisteredTask {
  content: TaskContent;
  mainPassage: PassageBlock;
}

export const TASK_REGISTRY: Record<string, RegisteredTask> = {
  "lesson-01": { content: lesson01, mainPassage: lesson01MainPassage },
  "lesson-02": { content: lesson02, mainPassage: lesson02MainPassage },
  "lesson-03": { content: lesson03, mainPassage: lesson03MainPassage },
  "lesson-04": { content: lesson04, mainPassage: lesson04MainPassage },
  "lesson-05": { content: lesson05, mainPassage: lesson05MainPassage },
  "lesson-06": { content: lesson06, mainPassage: lesson06MainPassage },
  "lesson-07": { content: lesson07, mainPassage: lesson07MainPassage },
  "lesson-08": { content: lesson08, mainPassage: lesson08MainPassage },
  "lesson-09": { content: lesson09, mainPassage: lesson09MainPassage },
  "lesson-10": { content: lesson10, mainPassage: lesson10MainPassage },
  "lesson-11": { content: lesson11, mainPassage: lesson11MainPassage },
  "lesson-12": { content: lesson12, mainPassage: lesson12MainPassage },
  "lesson-13": { content: lesson13, mainPassage: lesson13MainPassage },
};

export function getTaskContent(ref: string): RegisteredTask | null {
  return TASK_REGISTRY[ref] ?? null;
}

// Count the answerable units of a task (for the progress meter):
// 7 decode stages + every question field in every section.
export function countTaskUnits(reg: RegisteredTask): number {
  let questions = 0;
  for (const section of reg.content.sections) {
    for (const block of section.blocks) {
      if (block.type === "question") {
        questions += block.fields?.length ?? 1;
      }
    }
  }
  // 7 decode-stage completions (Part A) + comprehension answers + Part B questions.
  return 7 + reg.content.comprehension.length + questions;
}

// The fixed 7 pshat-decode stages — the iron rule of every task.
// Parallelism is not a stage of its own: it is a genre-specific tool that
// opens inside the genre stage only when שירה/נאום is chosen (or the task
// declares hasParallelism) — most genres simply don't have it.
// (why: one-or-two-word rationale shown to the student.)
export const DECODE_STAGES = [
  { n: 1, title: "מפגש ראשון", why: "קודם פוגשים, אחר־כך מנתחים" },
  { n: 2, title: "מילה מנחה", why: "המפתח שהתורה מניחה לנו" },
  { n: 3, title: "מילים קשות", why: "לדעת מה אני לא יודעת" },
  { n: 4, title: "סוגה", why: "לכל סוגה חוקי קריאה משלה" },
  { n: 5, title: "שאלת שאלות", why: "שאלה טובה = חצי הבנה" },
  { n: 6, title: "מבינים בכל זאת", why: "לא נתקעים על מה שחסר" },
  { n: 7, title: "בדיקת הבנה", why: "לוודא שבאמת הבנתי" },
] as const;
