import type { Metadata, Viewport } from "next";
import { Heebo, Assistant } from "next/font/google";
import "./globals.css";
import InstallPrompt from "@/components/pwa/install-prompt";
import RememberLastPath from "@/components/pwa/remember-last-path";

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
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-maskable.svg", apple: "/icons/icon-maskable.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "בינת התורה",
  },
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
        <RememberLastPath />
        {children}
        {/* Footer: school name and copyright pushed to the edges, the three
            role credits grouped tightly in the middle. */}
        <footer className="no-print mt-auto border-t border-[color:var(--border)]/60 px-6 py-5 text-[11px] leading-5 text-[color:var(--primary)]/50">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-y-2 text-center sm:flex-row sm:gap-x-10">
            <span className="whitespace-nowrap font-semibold">
              בית מדרש תורה שבכתב תיכון שחרית
            </span>
            <span className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1">
              <span>פיתוח וכתיבה: ריעות רוקח</span>
              <span aria-hidden>·</span>
              <span>ייעוץ והדרכה: נעמה סינגל</span>
              <span aria-hidden>·</span>
              <span>פריסת אתר: רפאל באסל</span>
            </span>
            <span className="whitespace-nowrap">כל הזכויות שמורות</span>
          </div>
        </footer>
        <InstallPrompt />
      </body>
    </html>
  );
}
