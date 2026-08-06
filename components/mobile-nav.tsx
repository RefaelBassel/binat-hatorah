"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavLink {
  href: string;
  label: string;
}

interface Props {
  links: NavLink[];
  userLabel: string;
  isTeacher: boolean;
  signOutAction: () => Promise<void>;
}

// Hamburger toggle + slide-in drawer for narrow screens. Rendered alongside
// the desktop nav and shown via `xl:hidden` from the parent.
export default function MobileNav({
  links,
  userLabel,
  isTeacher,
  signOutAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "סגירת תפריט" : "פתיחת תפריט"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-[color:var(--primary)] transition hover:bg-[color:var(--primary)]/5"
      >
        <BurgerIcon open={open} />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
          aria-hidden
        />
      )}

      {/* Drawer — anchored to the start (right in RTL). */}
      <aside
        className={[
          "pwa-safe-drawer fixed inset-y-0 start-0 z-50 flex w-80 max-w-[85vw] flex-col bg-[color:var(--card)] shadow-2xl transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border)] px-5 py-4">
          <span className="font-display text-base font-extrabold text-[color:var(--primary)]">
            בינת התורה
          </span>
          <button
            type="button"
            aria-label="סגירת תפריט"
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 text-[color:var(--primary)]/70 hover:bg-[color:var(--primary)]/5"
          >
            <CloseIcon />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {links.map((l) => {
              const active =
                pathname === l.href ||
                (l.href !== "/" && pathname.startsWith(l.href));
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={[
                      "block rounded-lg px-3 py-2.5 text-sm transition",
                      active
                        ? "bg-[color:var(--accent)]/15 font-semibold text-[color:var(--accent)]"
                        : "text-[color:var(--primary)] hover:bg-[color:var(--primary)]/5",
                    ].join(" ")}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-[color:var(--border)] px-5 py-4">
          <p className="text-xs text-[color:var(--primary)]/70">
            {userLabel}
            {isTeacher && (
              <span className="ms-2 rounded-full bg-[color:var(--accent)]/20 px-2 py-0.5 text-[10px] font-semibold text-[color:var(--accent)]">
                מורה
              </span>
            )}
          </p>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="w-full rounded-lg border border-[color:var(--border)] px-4 py-2 text-xs font-semibold text-[color:var(--primary)] transition hover:border-[color:var(--accent)]"
            >
              יציאה
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function BurgerIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      {open ? (
        <>
          <line x1="6" y1="6" x2="18" y2="18" />
          <line x1="18" y1="6" x2="6" y2="18" />
        </>
      ) : (
        <>
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </>
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  );
}
