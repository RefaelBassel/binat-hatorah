"use client";

import { useEffect, useState } from "react";

// =============================================================================
// PWA install support (ported from בינת התלמוד) — registers the service
// worker and ALWAYS surfaces an install entry point when not already
// running standalone. Chrome's beforeinstallprompt heuristics are flaky,
// so we show a small dismissible pill that either opens the native prompt
// (when available) or OS-specific manual instructions (Android / iPhone /
// desktop).
// =============================================================================

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const DISMISS_KEY = "bh-install-dismissed";

type Modal = "instructions" | null;

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [pillVisible, setPillVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [modal, setModal] = useState<Modal>(null);

  // Register the service worker once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        console.warn("[pwa] service worker registration failed:", err);
      });
    }, 1500);
    return () => window.clearTimeout(id);
  }, []);

  // Decide whether to show the pill on first paint.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    const dismissed =
      typeof sessionStorage !== "undefined" &&
      sessionStorage.getItem(DISMISS_KEY) === "1";
    if (dismissed) return;
    setPillVisible(true);
  }, []);

  // Capture the install prompt + handle installed event.
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    }
    function onAppInstalled() {
      setPillVisible(false);
      setDeferred(null);
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (deferred) {
      setInstalling(true);
      try {
        await deferred.prompt();
        await deferred.userChoice;
      } finally {
        setInstalling(false);
        setDeferred(null);
        setPillVisible(false);
      }
      return;
    }
    setModal("instructions");
  }

  function dismiss() {
    setPillVisible(false);
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.setItem(DISMISS_KEY, "1");
    }
  }

  return (
    <>
      {pillVisible && (
        <div
          role="dialog"
          aria-label="התקנת האפליקציה"
          className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-sm rounded-2xl border border-[color:var(--accent)]/40 p-4"
          style={{
            background: "var(--card)",
            boxShadow: "0 10px 30px -10px rgba(0,0,0,0.25)",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color:var(--accent)]/15 text-lg"
            >
              📱
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[color:var(--primary)]">
                התקנת בינת התורה למסך הבית
              </p>
              <p className="mt-1 text-xs leading-5 text-[color:var(--primary)]/70">
                פתיחה מהירה כמו אפליקציה, באנדרואיד ובאייפון.
              </p>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-[color:var(--primary)]/65 hover:text-[color:var(--primary)]"
                >
                  לא עכשיו
                </button>
                <button
                  type="button"
                  onClick={handleInstall}
                  disabled={installing}
                  className="rounded-lg bg-[color:var(--primary)] px-4 py-1.5 text-xs font-semibold text-white shadow transition hover:opacity-90 disabled:opacity-50"
                >
                  {installing ? "מתקינה…" : "התקנה"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {modal === "instructions" && (
        <InstructionsModal onClose={() => setModal(null)} />
      )}
    </>
  );
}

function InstructionsModal({ onClose }: { onClose: () => void }) {
  const platform = detectPlatform();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="הוראות התקנה"
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-t-3xl p-6 shadow-xl sm:rounded-3xl"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-[color:var(--primary)]">
          התקנת בינת התורה
        </h3>
        <p className="mt-1 text-xs text-[color:var(--primary)]/65">
          {platform === "android"
            ? "פעולה של שתיים-שלוש שניות."
            : platform === "ios"
              ? "פעולה ידנית — האייפון לא תומך בהתקנה אוטומטית."
              : "אם הדפדפן עוד לא הציע התקנה, אפשר ידנית."}
        </p>

        <ol className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--primary)]">
          {platform === "android" && (
            <>
              <li className="flex gap-3">
                <Step n={1} />
                <span>לחצי על תפריט Chrome — שלוש הנקודות (⋮) למעלה.</span>
              </li>
              <li className="flex gap-3">
                <Step n={2} />
                <span>
                  בחרי <strong>״התקנת אפליקציה״</strong> או{" "}
                  <strong>"Add to Home screen"</strong>.
                </span>
              </li>
              <li className="flex gap-3">
                <Step n={3} />
                <span>אשרי — והאייקון יופיע במסך הבית.</span>
              </li>
            </>
          )}
          {platform === "ios" && (
            <>
              <li className="flex gap-3">
                <Step n={1} />
                <span>
                  ודאי שאת ב-<strong>Safari</strong> (לא Chrome).
                </span>
              </li>
              <li className="flex gap-3">
                <Step n={2} />
                <span>לחצי על אייקון השיתוף בתחתית — ריבוע עם חץ למעלה.</span>
              </li>
              <li className="flex gap-3">
                <Step n={3} />
                <span>
                  גללי ובחרי <strong>"Add to Home Screen"</strong> /{" "}
                  <strong>״הוספה למסך הבית״</strong>.
                </span>
              </li>
            </>
          )}
          {platform === "desktop" && (
            <>
              <li className="flex gap-3">
                <Step n={1} />
                <span>
                  בשורת הכתובת חפשי אייקון התקנה (מסך עם חץ למטה) ליד הכוכבית.
                </span>
              </li>
              <li className="flex gap-3">
                <Step n={2} />
                <span>
                  אם אין — תפריט Chrome (⋮) → <strong>Cast, Save and Share</strong>{" "}
                  → <strong>Install app</strong>.
                </span>
              </li>
            </>
          )}
        </ol>

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-xl bg-[color:var(--primary)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          הבנתי
        </button>
      </div>
    </div>
  );
}

function Step({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent)]/15 text-xs font-bold text-[color:var(--accent)]"
    >
      {n}
    </span>
  );
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (
    window.matchMedia &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function detectPlatform(): "android" | "ios" | "desktop" {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  return "desktop";
}
