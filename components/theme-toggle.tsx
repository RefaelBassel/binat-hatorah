"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_STORAGE_KEY, isTheme, type Theme } from "@/lib/theme";

// The dark-mode switch ("מצב כהה"). The current theme lives on
// <html data-theme> (set by the root layout / THEME_INIT_SCRIPT); every
// toggle on the page watches that attribute, so the top-nav icon and the
// switch on /me stay in sync. A click applies the theme instantly, keeps it
// on this device (localStorage + cookie) and — when signed in — saves it on
// the account so it follows the user to other devices.

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

function readTheme(): Theme | null {
  const t = document.documentElement.dataset.theme;
  return isTheme(t) ? t : null;
}

type SaveState = "idle" | "saving" | "saved" | "local";

export default function ThemeToggle({
  initial,
  persist,
  variant = "icon",
}: {
  initial: Theme | null;
  persist: boolean;
  variant?: "icon" | "panel";
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initial);
  const [save, setSave] = useState<SaveState>("idle");
  const seq = useRef(0);
  const dark = theme === "dark";

  const toggle = async () => {
    const next: Theme = dark ? "light" : "dark";
    const root = document.documentElement;
    root.dataset.theme = next;
    delete root.dataset.themeAuto; // an explicit choice stops following the device
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode — the cookie still keeps it */
    }
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    if (!persist) return;
    const mine = ++seq.current;
    setSave("saving");
    const res = await fetch("/api/profile/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme: next }),
    }).catch(() => null);
    if (mine !== seq.current) return; // a newer click is in flight
    setSave(res?.ok ? "saved" : "local");
    if (res?.ok) {
      setTimeout(() => {
        if (mine === seq.current) setSave("idle");
      }, 2000);
    }
  };

  const label = dark ? "מעבר למצב בהיר" : "מעבר למצב כהה";
  const status =
    save === "saving"
      ? "שומר…"
      : save === "saved"
        ? "נשמר ✓"
        : save === "local"
          ? "נשמר במכשיר הזה בלבד — לא הצלחנו לשמור בחשבון"
          : "";

  if (variant === "panel") {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs font-bold text-[color:var(--primary)]/70">🌙 מצב כהה (מסך חשוך):</p>
        <button
          type="button"
          role="switch"
          aria-checked={dark}
          onClick={toggle}
          className={[
            "relative inline-flex h-7 w-14 shrink-0 items-center rounded-full border transition",
            dark
              ? "border-[color:var(--primary)] bg-[color:var(--primary-fill)]"
              : "border-[color:var(--border)] bg-[color:var(--border)]/60",
          ].join(" ")}
        >
          <span className="sr-only">מצב כהה</span>
          <span
            aria-hidden
            className={[
              "absolute top-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color:var(--card)] text-[color:var(--primary)] shadow transition-all",
              dark ? "start-[30px]" : "start-0.5",
            ].join(" ")}
          >
            {dark ? <MoonIcon size={13} /> : <SunIcon size={13} />}
          </span>
        </button>
        <span className="text-xs font-semibold text-[color:var(--primary)]">
          {theme === null ? "" : dark ? "פעיל" : "כבוי"}
        </span>
        {status && (
          <span
            className={`save-fade text-xs ${save === "local" ? "text-[color:var(--warning)]" : save === "saved" ? "text-[color:var(--success)]" : "text-[color:var(--primary)]/60"}`}
          >
            {status}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={status ? `${label} — ${status}` : label}
      aria-pressed={dark}
      title={status || label}
      className="relative rounded-full p-2 text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/5"
    >
      {/* sun in dark mode (where the click leads), moon in light mode */}
      {dark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      {save !== "idle" && (
        <span
          aria-hidden
          className={[
            "absolute bottom-1 left-1 h-2 w-2 rounded-full ring-2 ring-[color:var(--card)]",
            save === "saving"
              ? "animate-pulse bg-[color:var(--accent)]"
              : save === "saved"
                ? "bg-[color:var(--success)]"
                : "bg-[color:var(--warning)]",
          ].join(" ")}
        />
      )}
    </button>
  );
}

function MoonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function SunIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}
