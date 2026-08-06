import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

// Middleware uses the edge-safe authConfig (no DB, no node:fs).
// The `authorized` callback in authConfig allows / , /login and /api/auth;
// here we handle the onboarding redirect for authed-but-not-onboarded users.
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;

  const isAuthed = Boolean(req.auth?.user);
  const isOnboarded = Boolean(req.auth?.user?.onboarded);
  const isGuest = Boolean(req.auth?.user?.guest);

  // Guest sessions block every mutating API call (POST/PATCH/PUT/DELETE)
  // except the auth endpoints.
  if (
    isGuest &&
    req.method !== "GET" &&
    req.method !== "HEAD" &&
    path.startsWith("/api/") &&
    !path.startsWith("/api/auth")
  ) {
    return NextResponse.json(
      { error: "מצב צפייה בלבד — לא ניתן לבצע פעולה זו." },
      { status: 403 }
    );
  }

  // Public paths: the landing page (/) is open to everyone — logged-out
  // visitors see the hero with a Google sign-in button.
  const publicPaths = ["/", "/login", "/api/auth"];
  const isPublic = publicPaths.some(
    (p) => path === p || path.startsWith(p + "/")
  );
  if (isPublic) {
    if (
      isAuthed &&
      !isOnboarded &&
      path !== "/onboarding" &&
      !path.startsWith("/api/auth")
    ) {
      return NextResponse.redirect(new URL("/onboarding", nextUrl));
    }
    return NextResponse.next();
  }

  if (!isAuthed) {
    return NextResponse.redirect(new URL("/login", nextUrl));
  }

  if (!isOnboarded && path !== "/onboarding") {
    return NextResponse.redirect(new URL("/onboarding", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Exclude Next.js internals and static assets so they're never redirected.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
