import PageShell from "@/components/page-shell";

// The full annual program — from content/source/annual-plan.md (Reut's plan),
// PLUS the explicit framing Rafael added: the program cultivates TWO central
// skills, and pshat-decoding (with question-asking) is the first and the
// precondition for everything else.
export default function ProgramPage() {
  return (
    <PageShell
      title="התוכנית ולו״ז"
      subtitle="תכנית עבודה שנתית בתנ״ך · כיתה י · נושא שנתי: אחריות קהילתית · גישה: למידה מבוססת בעיה (PBL)"
    >
      <div className="mx-auto max-w-4xl space-y-10">
        {/* ===== the two central skills ===== */}
        <section>
          <SectionTitle emoji="🎯" title="שתי המיומנויות שבמרכז התוכנית" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-[color:var(--accent)]/50 bg-[color:var(--card)] p-6">
              <p className="mb-1 text-[10px] font-bold tracking-[0.25em] text-[color:var(--accent)]">
                מיומנות ראשונה · הבסיס לכל השאר
              </p>
              <h3 className="font-display text-xl font-bold text-[color:var(--primary)]">
                פענוח טקסט על דרך הפשט
              </h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]/75">
                היכולת להבין מה כתוב במקרא — לבד, ככל האפשר. זהו תנאי הסף לכל מה
                שבא אחר כך: לפרשנים, לזיהוי הטיעונים ולדיון בהם. ויש כאן גם ערך
                חינוכי: לפני שמבינים באמת — לא שופטים.
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[
                  "📌 מילה מנחה",
                  "❓ שאלת שאלות",
                  "🤔 מילים קשות",
                  "🪞 תקבולת",
                  "🎭 אפיון סוגה",
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-[color:var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent)]"
                  >
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs leading-6 text-[color:var(--foreground)]/60">
                כל משימה באתר נפתחת בפענוח אינטראקטיבי כזה, וכל שאלה שנשאלת
                נאספת למאגר השאלות האישי — ממנו תצמח עבודת המיני-סמינריון.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
              <p className="mb-1 text-[10px] font-bold tracking-[0.25em] text-[color:var(--primary)]/50">
                מיומנות שנייה · המשלב הגבוה
              </p>
              <h3 className="font-display text-xl font-bold text-[color:var(--primary)]">
                ניסוח, זיהוי וניתוח טיעון
              </h3>
              <p className="mt-2 text-sm leading-7 text-[color:var(--foreground)]/75">
                טענה, נימוק וביסוס — המיומנות שמאפשרת לדון בטקסט באופן מושכל,
                והיא חשובה אקדמית וגם לחיים. מתפתחת בהדרגה לאורך השנה בשלושה
                שלבים:
              </p>
              <ol className="mt-3 space-y-2 text-xs leading-6">
                <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                  <b>שלב א׳ · תחילת שנה</b> — זיהוי מרכיבי טענה: הבחנה בין טענה,
                  נימוק (ראיה/ביסוס) ומסקנה.
                </li>
                <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                  <b>שלב ב׳ · אמצע שנה</b> — הפרכת טענה וטענת נגד: זיהוי הנחות
                  יסוד ונקודות תורפה.
                </li>
                <li className="rounded-lg bg-[color:var(--background)] px-3 py-2">
                  <b>שלב ג׳ · סוף שנה</b> — גיבוש טענה עצמאית ומורכבת וחיבור בין
                  מקורות למציאות קהילתית.
                </li>
              </ol>
            </div>
          </div>
        </section>

        {/* ===== grade distribution ===== */}
        <section>
          <SectionTitle emoji="🏅" title="התפלגות הציון השנתי" />
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-6">
            {[
              { pct: 30, label: "הערכה תהליכית שוטפת", detail: "השתתפות דיאלוגית, תרגולי טיעון, הגשות קטנות ומשימות מעקב", color: "var(--primary)" },
              { pct: 20, label: "מבחן מחצית א׳", detail: "בקיאות ותפיסת עומק בחומש במדבר + זיהוי והפרכת טיעונים", color: "var(--accent)" },
              { pct: 20, label: "מבחן מחצית ב׳", detail: "בקיאות בספר מלכים + ניסוח טענה מורכבת ומנומקת מול מקורות", color: "var(--accent)" },
              { pct: 15, label: "תוצר א׳ (מחצית א׳)", detail: "ניתוח עימות קהילתי בתנ״ך וכתיבת נייר עמדה מבוסס טיעון", color: "var(--success)" },
              { pct: 15, label: "תוצר ב׳ (מחצית ב׳)", detail: "עבודת חקר PBL + הצגה בתערוכת תוצרים (Exhibition)", color: "var(--success)" },
            ].map((row) => (
              <div key={row.label} className="mb-4 last:mb-0">
                <div className="mb-1 flex items-baseline justify-between gap-3">
                  <p className="text-sm font-bold text-[color:var(--primary)]">
                    {row.label}
                    <span className="ms-2 font-display text-lg" style={{ color: row.color }}>
                      {row.pct}%
                    </span>
                  </p>
                  <p className="text-[11px] text-[color:var(--foreground)]/55">{row.detail}</p>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-[color:var(--border)]/40">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.pct}%`, background: row.color, opacity: 0.85 }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== annual timeline ===== */}
        <section>
          <SectionTitle emoji="🗓️" title="הפריסה השנתית" />
          <div className="space-y-4">
            {TIMELINE.map((t, i) => (
              <div
                key={i}
                className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[color:var(--primary)] px-3 py-1 text-[11px] font-bold text-white">
                    {t.half}
                  </span>
                  <span className="rounded-full bg-[color:var(--accent)]/15 px-3 py-1 text-[11px] font-bold text-[color:var(--accent)]">
                    {t.months} · {t.greg}
                  </span>
                  {t.milestone && (
                    <span className="rounded-full bg-[color:var(--danger)]/10 px-3 py-1 text-[11px] font-bold text-[color:var(--danger)]">
                      ⭐ {t.milestone}
                    </span>
                  )}
                </div>
                <div className="grid gap-3 text-xs leading-6 sm:grid-cols-3">
                  <div>
                    <p className="mb-0.5 font-bold text-[color:var(--primary)]">📖 תכנים</p>
                    <p className="text-[color:var(--foreground)]/75">{t.content}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 font-bold text-[color:var(--primary)]">🤝 אחריות קהילתית</p>
                    <p className="text-[color:var(--foreground)]/75">{t.theme}</p>
                  </div>
                  <div>
                    <p className="mb-0.5 font-bold text-[color:var(--primary)]">⚖️ מיומנות + הערכה</p>
                    <p className="text-[color:var(--foreground)]/75">{t.skill}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ===== chapters + commentators ===== */}
        <section>
          <SectionTitle emoji="📚" title="הפרקים והמפרשים" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
              <h3 className="mb-2 font-display text-base font-bold text-[color:var(--primary)]">
                חומש במדבר <span className="text-xs font-normal text-[color:var(--foreground)]/55">— פשט עם מפרשים</span>
              </h3>
              <p className="text-xs leading-6 text-[color:var(--foreground)]/75">
                פרקים ט׳–י׳ (פסח שני ומסע המחנות), י״א (המתאוננים ומינוי הזקנים),
                י״ב (מרים ואהרון), י״ג–י״ד (המרגלים), ט״ו, ט״ז–י״ז (עדת קרח), י״ט
                (פרה אדומה), כ׳ (מי מריבה), כ״א (נחש הנחושת), כ״ה (בעל פעור),
                כ״ז + ל״ו (בנות צלפחד), כ״ח, ל״ב (בני גד וראובן).
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["רש״י", "רמב״ן", "רשב״ם", "ספר החינוך", "מדרש", "משנה ותלמוד"].map((p) => (
                  <span key={p} className="rounded-full bg-[color:var(--primary)]/8 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--primary)]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
              <h3 className="mb-2 font-display text-base font-bold text-[color:var(--primary)]">
                ספר מלכים <span className="text-xs font-normal text-[color:var(--foreground)]/55">— פשט בלבד, ללא מפרשים</span>
              </h3>
              <p className="text-xs leading-6 text-[color:var(--foreground)]/75">
                שש יחידות בקיאות: מלכות שלמה · פילוג הממלכה · אליהו ואחאב ·
                מהפכות ותמורות · הכיבוש האשורי · סופה של ממלכת יהודה וחורבן
                המקדש. הלימוד על פי פשטי המקראות, כולל מפות ונושאי רוחב.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["סיבתיות כפולה", "מנהיג ומנהיגות", "בית המקדש", "מלך ונביא", "ישראל והעמים", "אחדות ופילוג"].map((p) => (
                  <span key={p} className="rounded-full bg-[color:var(--accent)]/10 px-2.5 py-1 text-[11px] font-semibold text-[color:var(--accent)]">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ===== products ===== */}
        <section>
          <SectionTitle emoji="🎨" title="שלושת התוצרים" />
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                emoji: "📄",
                title: "תוצר א׳ · נייר עמדה",
                when: "מחצית א׳",
                body: "בחירת מחלוקת מחומש במדבר (עדת קרח, המרגלים, המתאוננים...), מיפוי טענות כל הצדדים, וכתיבת נייר עמדה מנומק המציע פתרון מנהיגותי-קהילתי חלופי.",
              },
              {
                emoji: "🔬",
                title: "תוצר ב׳ · עבודת חקר PBL",
                when: "מחצית ב׳",
                body: "״אחריות קהילתית: מתנ״ך לאקטואליה״ — בעיה קהילתית אמיתית, מקור תנ״כי מקביל, טיעון מורכב והצעה מעשית. פורמט לבחירה: נייר מדיניות / פודקאסט / פוסטר / סרטון. שיא: תערוכת תוצרים.",
              },
              {
                emoji: "🌟",
                title: "מיני-סמינריון",
                when: "מהמאגר האישי",
                body: "לאורך השנה כל שאלה ששואלים נאספת למאגר האישי. בסוף בוחרים שאלה אחת שמעניינת באמת, וחוקרים אותה לעומק בעבודה אישית.",
              },
            ].map((p) => (
              <div key={p.title} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
                <p className="text-2xl">{p.emoji}</p>
                <h3 className="mt-1 font-display text-base font-bold text-[color:var(--primary)]">{p.title}</h3>
                <p className="text-[11px] font-bold text-[color:var(--accent)]">{p.when}</p>
                <p className="mt-2 text-xs leading-6 text-[color:var(--foreground)]/75">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ===== differentiation ===== */}
        <section>
          <SectionTitle emoji="🌈" title="הוראה מותאמת לכל תלמיד ותלמידה" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { emoji: "🪜", title: "פיגומים", body: "תבניות מובנות לניסוח טיעון, מילות קישור מנחות, והנחיה צמודה בשלבי החקר — ועזרת קלוד בכל שלב, לפי העיקרון: עושים לבד, אבל לא פוגשים קיר." },
              { emoji: "🚀", title: "אתגר", body: "פרשנות מתקדמת (רש״י, רמב״ן, פרשנות מודרנית), טיעוני נגד מורכבים והובלת דיונים." },
              { emoji: "🎤", title: "ריבוי דרכי ביטוי", body: "הערכה חלופית והצגת תוצרים במגוון מדיות — בכתב, חזותי וקולי." },
            ].map((d) => (
              <div key={d.title} className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--card)] p-5">
                <p className="text-xl">{d.emoji}</p>
                <h3 className="font-display text-sm font-bold text-[color:var(--primary)]">{d.title}</h3>
                <p className="mt-1 text-xs leading-6 text-[color:var(--foreground)]/75">{d.body}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

const TIMELINE = [
  {
    half: "מחצית א׳",
    months: "תשרי–חשון",
    greg: "ספטמבר–נובמבר",
    content: "במדבר: פרק ט׳ (פסח שני), מסע בני ישראל, פרק י״א (תלונות העם ומינוי 70 הזקנים)",
    theme: "בין הפרט לקהילה: אחריות הקהילה כלפי מי שבשוליים; מנהיגות מול עומס",
    skill: "שלב א׳ — זיהוי מרכיבי טענה (״למה נגרע?״) · תרגול ״שלד טיעון״ ראשון",
    milestone: null,
  },
  {
    half: "מחצית א׳",
    months: "כסלו–טבת",
    greg: "דצמבר–ינואר",
    content: "במדבר: י״ב (מרים ואהרון), י״ג–י״ד (המרגלים), ט״ז–י״ז (עדת קרח)",
    theme: "חוסן קהילתי: מתי מחלוקת בונה ומתי מפרקת",
    skill: "שלב ב׳ — הפרכת טענה: קרח מול משה · תרגיל דיבייט · טיוטת תוצר א׳",
    milestone: null,
  },
  {
    half: "מחצית א׳",
    months: "שבט",
    greg: "ינואר–פברואר",
    content: "במדבר: כ׳ (מי מריבה), כ״א (נחש הנחושת), כ״ה (בעל פעור ופנחס)",
    theme: "משברים וגבולות אחריות",
    skill: "שלב ב׳–ג׳ — ניתוח משווה",
    milestone: "הגשת תוצר א׳ + מבחן מחצית א׳",
  },
  {
    half: "מחצית ב׳",
    months: "אדר–ניסן",
    greg: "מרץ–אפריל",
    content: "במדבר כ״ז+ל״ו (בנות צלפחד), ל״ב (בני גד וראובן) · מלכים א׳ א׳–י״א (שלמה), י״ב (הפילוג)",
    theme: "צדק, שוויון ואינטרס קהילתי",
    skill: "שלב ג׳ — עמדה מנומקת · התנעת תוצר ב׳: שאלת חקר",
    milestone: null,
  },
  {
    half: "מחצית ב׳",
    months: "אייר–סיון",
    greg: "מאי–יוני",
    content: "מלכים א׳ י״ז–י״ט (אליהו ואחאב), כ״א (כרם נבות) · מלכים ב׳ (מהפכות, אשור, חורבן)",
    theme: "צדק חברתי מול השלטון: נבות, תוכחה ושחיתות",
    skill: "שלב ג׳ — טיעון מורכב רב-תחומי · כתיבת עבודת החקר",
    milestone: null,
  },
  {
    half: "מחצית ב׳",
    months: "סיון–תמוז",
    greg: "יוני–יולי",
    content: "סיכום ואינטגרציה: חורבן מול בניין קהילתי",
    theme: "אחריות קהילתית אקטואלית",
    skill: "רפלקציה והצגת טיעונים בעל פה",
    milestone: "תערוכת תוצרים + תוצר ב׳ + מבחן מחצית ב׳",
  },
] as const;

function SectionTitle({ emoji, title }: { emoji: string; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-bold text-[color:var(--primary)]">
      <span>{emoji}</span> {title}
    </h2>
  );
}
