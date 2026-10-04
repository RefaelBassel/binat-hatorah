// Measure the real input size of the Claude calls this site makes, with the
// Messages count_tokens endpoint (free). Used to estimate running costs.
// Run: npx tsx scripts/count-assist-tokens.mts   (needs ANTHROPIC_API_KEY in .env.local)
import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { TASK_REGISTRY } from "../content/tasks/registry";
import { CLAUDE_MODEL } from "../lib/claude";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim().replace(/^"|"$/g, "")])
);
const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
const routeSrc = readFileSync("app/api/assist/route.ts", "utf8");
const sys = routeSrc.slice(routeSrc.indexOf("const SYSTEM_PROMPT = `") + 23, routeSrc.indexOf("`;", routeSrc.indexOf("const SYSTEM_PROMPT = `")));

async function count(label: string, system: string, user: string, extra: { role: "user" | "assistant"; content: string }[] = []) {
  const r = await client.messages.countTokens({ model: CLAUDE_MODEL, system, messages: [{ role: "user", content: user }, ...extra] });
  console.log(`${label.padEnd(50)} ${String(r.input_tokens).padStart(6)} input tokens`);
}

const regs = Object.entries(TASK_REGISTRY).map(([ref, r]) => ({ ref, r, n: r.mainPassage.verses.length }));
regs.sort((a, b) => a.n - b.n);
const shortest = regs[0];
const median = regs[Math.floor(regs.length / 2)];
const longest = regs[regs.length - 1];
console.log(`model: ${CLAUDE_MODEL} · ${regs.length} tasks · passages ${shortest.n}–${longest.n} verses\n`);

const history = Array.from({ length: 6 }, () => `- הקשר: ${"שאלה על הפסוקים ".repeat(6).slice(0, 120)} | שאלה: ${"לא הבנתי מה זה אומר ".repeat(6).slice(0, 120)} | ענית: ${"נסו לקרוא שוב את הפסוק ולשים לב למילה ".repeat(3).slice(0, 120)}`).join("\n");
const head = `שם התלמיד/ה: נועה כהן — לפנייה מדי פעם בשם הפרטי בלבד, בלי להסיק מגדר.\n\nהיסטוריית עזרה כללית (להתאמת גובה העזרה):\n${history}\n\nההקשר הנוכחי במשימה:\n`;
const passage = (x: typeof shortest) => x.r.mainPassage.verses.map((v) => v.text).join(" ");

await count("system prompt + history, no passage (plain question)", sys, head + "שאלה: מה המילה המנחה בקטע? מה שכתבתי: (ריק)", [{ role: "user", content: "לא הבנתי מה השאלה רוצה" }]);
for (const x of [shortest, median, longest]) {
  await count(`decode-stage help with passage · ${x.ref} (${x.n} verses)`, sys, head + `בדיקת מילה מנחה בקטע ${x.r.mainPassage.ref}.\nהקטע המלא: ${passage(x)}\nמועמדות: - קר״ב\n- עש״ה\nהמילה שסומנה: ״וַיִּקְרְבוּ״`);
}
const qa = Array.from({ length: 24 }, (_, i) => `שאלה [קריאה והבנה — שדה ${i + 1}]: קראו את הפסוקים וענו מה כתוב, מי אומר למי, ולמה.\nתשובה: ${"משה אומר לעם שישמרו את המצוות כי זה מה שה׳ ציווה והם צריכים להקשיב ".repeat(2)}`).join("\n\n");
await count(`grading proposal · ${longest.ref}`, `את/ה עוזר/ת הערכה למורה... הקטע הנלמד: ${longest.r.mainPassage.ref}: ${longest.r.mainPassage.verses.map((v) => `(${v.num}) ${v.text}`).join(" ")}\nהחזר/י JSON בלבד.`, `שם התלמיד/ה: נועה כהן\n\nשאלות ותשובות:\n${qa}`);
await count("writing exercise evaluation", `את/ה מעריך/ה תרגולי כתיבה טיעונית באתר "בינת התורה"... החזר/י JSON בלבד.`, `התרגיל: זהו את מרכיבי הטיעון\nהתשובה:\nטענה: ${"צריך לכבד הורים גם כשקשה ".repeat(8)}\nנימוק: ${"כי התורה מצווה וגם כי הם גידלו אותנו ".repeat(8)}\nביסוס: ${"כבד את אביך ואת אמך ".repeat(6)}`);
await count(`review aid (closing deck) · ${longest.ref}`, `את/ה עוזר/ת למורה להכין סיכום...`, `הקטע: ${longest.r.mainPassage.verses.map((v) => `(${v.num}) ${v.text}`).join(" ")}\nשאלות הכיתה: ${"למה משה חזר על זה פעמיים? ".repeat(10)}`);
