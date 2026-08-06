import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";

// Middleware uses the edge-safe authConfig (no DB, no node:fs).
// The `authorized` callback in authConfig allows / , /login and /api/auth;
// here we handle the onboarding redirect for authed-but-not-onboarded users.
const { auth } = NextAuth(authConfig);

const handler = auth((req) => {
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

// TEMPORARY DIAGNOSTICS for the production 500 (MIDDLEWARE_INVOCATION_FAILED):
// /__mw-health reports whether env vars are visible to the proxy runtime,
// and any handler exception is surfaced with its stack instead of a blank 500.
// Remove once the deployment is stable.
export default async function middleware(
  req: Parameters<typeof handler>[0],
  ctx: Parameters<typeof handler>[1]
) {
  if (req.nextUrl.pathname === "/__mw-health") {
    return NextResponse.json({
      hasAuthSecret: Boolean(process.env.AUTH_SECRET),
      hasGoogleId: Boolean(process.env.AUTH_GOOGLE_ID),
      hasGoogleSecret: Boolean(process.env.AUTH_GOOGLE_SECRET),
      hasTursoUrl: Boolean(process.env.TURSO_DATABASE_URL),
    });
  }
  try {
    return await handler(req, ctx);
  } catch (err) {
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    return new NextResponse(`MW ERROR: ${detail}`, { status: 500 });
  }
}

export const config = {
  // Exclude Next.js internals and static assets so they're never redirected.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
