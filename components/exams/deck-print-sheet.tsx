import { PrintNow } from "@/components/exams/list-actions";
import type { PublicSlide } from "@/lib/student-decks";

// Print / PDF sheet of a deck: one slide per page, no speaker notes.
export default function DeckPrintSheet({ slides }: { slides: PublicSlide[] }) {
  return (
    <main className="mx-auto w-full max-w-4xl bg-white px-8 py-8 text-black print:max-w-none print:p-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3 text-[color:var(--foreground)]">
        <span className="text-sm">שקופית אחת בכל עמוד · בחלון ההדפסה אפשר לבחור ״שמירה כ־PDF״</span>
        <PrintNow />
      </div>
      {slides.map((s, i) => (
        <section
          key={s.id}
          dir="rtl"
          className="flex min-h-[170mm] flex-col justify-center border border-gray-300 p-10 print:min-h-0 print:h-[180mm] print:border-0"
          style={{ breakAfter: i < slides.length - 1 ? "page" : "auto", breakInside: "avoid" }}
        >
          <h2 className="mb-6 text-4xl font-bold">{s.title}</h2>
          <ul className="space-y-3 text-2xl leading-relaxed">
            {s.bullets.map((b, j) => (
              <li key={j} className={b.level === 1 ? "pe-10 text-xl" : ""}>
                {b.level === 1 ? "– " : "• "}
                {b.text}
              </li>
            ))}
          </ul>
          <p className="mt-auto pt-6 text-sm text-gray-500" dir="ltr">
            {i + 1} / {slides.length}
          </p>
        </section>
      ))}
    </main>
  );
}
