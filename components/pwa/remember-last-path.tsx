"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

// =============================================================================
// PWA last-path memory (ported from בינת התלמוד): a standalone relaunch
// lands on start_url ("/"); this restores the last meaningful page so the
// student reopens the app exactly where she stopped.
// =============================================================================

const KEY = "bh-last-path";
const NON_REMEMBERED = new Set<string>(["/", "/login", "/onboarding"]);

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  ) {
    return true;
  }
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

export default function RememberLastPath() {
  const pathname = usePathname();
  const router = useRouter();

  // (1) On every meaningful path change, save it.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (NON_REMEMBERED.has(pathname)) return;
    try {
      localStorage.setItem(KEY, pathname);
    } catch {
      /* localStorage may be disabled — silently ignore */
    }
  }, [pathname]);

  // (2) On a fresh launch landing at "/", in standalone mode, restore.
  useEffect(() => {
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (!isStandalone()) return;
    if (window.history.length > 2) return;
    let last: string | null = null;
    try {
      last = localStorage.getItem(KEY);
    } catch {
      return;
    }
    if (!last || NON_REMEMBERED.has(last) || last === "/") return;
    router.replace(last);
  }, [pathname, router]);

  return null;
}
