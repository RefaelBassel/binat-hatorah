@AGENTS.md

# Claude Code instructions — binat-hatorah (בינת התורה)

## What this is
Learning site for 10th-grade girls studying **תורה ונביאים לבגרות** at תיכון שחרית.
Sister site of בינת התלמוד (`C:\Users\User\Documents\gemara10`) — same architecture,
separate accounts (new Turso DB, new Vercel project, new Google OAuth client).

Site name: בינת התורה. Subtitle: תורה ונביאים לבגרות בכיתה י, תיכון שחרית.
Second subtitle: בדגש על מיומנויות לימוד עצמי של פשט התורה (שאלת שאלות, זיהוי
מילה מנחה, תקבולות, מילים קשות וכיוצ"ב) וכתיבה טיעונית.

## Working rules (from Rafael)
1. **Plan before code.** New phase → written plan → wait for approval → implement.
2. **Hebrew UI, English code.** Students and teachers see 100% Hebrew RTL. Identifiers,
   comments, commit messages: English.
3. **No speculative content.** The specs for /writing, /debate, /product-a, /product-b,
   exam drills, and the detailed curriculum come from Rafael/Reut later — do not invent.
4. **Ask before choosing between 2 reasonable options.**

## Stack invariants
- Next.js 16 (App Router, Turbopack) + TypeScript + Tailwind v4
- Auth.js (next-auth v5 beta): Google sign-in + guest (read-only) credentials provider
- Turso (libSQL) via `@libsql/client` — raw SQL, no ORM; local dev uses `file:local.db`
- Migrations: `migrations/00NN_*.sql`, additive only; apply with `node scripts/migrate.mjs`
- Vercel deploy target (new project, not gemara10's)

## Language and typography
- `<html lang="he" dir="rtl">`
- Fonts via `next/font`: **Heebo** (body) + **Assistant** (display headings) — same as בינת התלמוד
- Palette 4 "גפן ותאנה": bg `#fbf6f1`, ink `#2e2438`, primary `#413055` (grape),
  accent `#b96a3b` (copper), card `#fffdfa`, border `#e9ddd2`,
  status: success `#3e6b4f` / warning `#b3892b` / danger `#9d3438`
- Hebrew only in visible text — never in `className`, `id`, or `data-*`

## Roles
- Teachers (lib/roles.ts): reutst99@gmail.com (ריעות רוקח), refaelbassel@gmail.com (רפאל)
- Everyone else who signs in with Google = student
- First login → /onboarding: full Hebrew name (displayed everywhere instead of Google name)

## Pages (top nav order)
דף הבית (/), עמוד אישי (/me), התוכנית ולו"ז (/program), משימות שוטפות (/tasks),
הכנות למבחנים (/exams), תרגול כתיבה טיעונית (/writing), הדיבייט (/debate),
תוצר א (/product-a), תוצר ב (/product-b), קשר (/messages), דשבורד מורה (/dashboard, teacher only)

## Footer (exact text, every page)
בית מדרש תורה שבכתב תיכון שחרית · פיתוח וכתיבה: ריעות רוקח · ייעוץ והדרכה: נעמה סינגל · פריסת אתר: ר. ב. · כל הזכויות שמורות

## Planned behaviors (later phases)
- Tasks: teacher assigns per-student; statuses נלמדה/בלימוד/עבר זמנה (+טרם נלמדה for teacher), color-coded
- Notifications: submission → teacher email + bell; overdue → teacher & student; grade entered → student email
- Claude-assisted grading: Claude proposes score + feedback, teacher edits and approves
- /messages: personal + group chat (learn from gemara10 lib/messages.ts)
- /me: highly visual learning status (like the אמונה site journey)
