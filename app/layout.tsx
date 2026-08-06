import type { Metadata, Viewport } from "next";
import { Heebo, Assistant } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

// Assistant — used for hero/display headings. Heebo is the body font.
const assistant = Assistant({
  variable: "--font-assistant",
  subsets: ["hebrew", "latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "בינת התורה",
  description:
    "תורה ונביאים לבגרות בכיתה י, תיכון שחרית — בדגש על מיומנויות לימוד עצמי של פשט התורה וכתיבה טיעונית.",
};

export const viewport: Viewport = {
  themeColor: "#413055",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="he"
      dir="rtl"
      className={`${heebo.variable} ${assistant.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <footer className="no-print mt-auto border-t border-[color:var(--border)]/60 px-4 py-4 text-center text-[11px] leading-5 text-[color:var(--primary)]/50">
          בית מדרש תורה שבכתב תיכון שחרית · פיתוח וכתיבה: ריעות רוקח · ייעוץ
          והדרכה: נעמה סינגל · פריסת אתר: ר. ב. · כל הזכויות שמורות
        </footer>
      </body>
    </html>
  );
}
