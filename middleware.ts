import { NextResponse, type NextRequest } from "next/server";

// Deliberately auth-library-free middleware. next-auth crashed at module
// init in Vercel's Edge runtime, and Vercel's router 404'd the Next 16
// proxy.ts convention — so the middleware does only what a cookie check
// can do: gate protected routes on session-cookie PRESENCE.
//
// Everything deeper is enforced where it belongs:
//   - real session validation: every page calls auth() and redirects
//   - onboarding redirect: PageShell + the non-shell pages (/, /me, /tasks/[id])
//   - guest write-blocking: every mutating API route checks user.guest
const PUBLIC_PATHS = ["/", "/login", "/api/auth"];

export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some(
    (p) => path === p || path.startsWith(p + "/")
  );
  if (isPublic) return NextResponse.next();

  const hasSessionCookie =
    req.cookies.has("authjs.session-token") ||
    req.cookies.has("__Secure-authjs.session-token");
  if (!hasSessionCookie) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|images/|icons/|sw\\.js|manifest\\.webmanifest).*)",
  ],
};
