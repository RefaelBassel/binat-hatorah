import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

// Edge-safe Auth.js config. No DB imports, no node:fs — used by proxy.ts
// (Edge runtime) and by the server-only auth.ts file which extends this
// with DB-backed callbacks.
//
// Sign-in is Google only. The former read-only "guest" entry was removed
// (Rafael, 2026-09-27): nobody enters without a Google account that a
// teacher has approved.
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Route guard used by proxy.ts. Everything deeper happens in auth.ts.
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const user = auth?.user;
      // sign-out and the auth handlers must always work
      if (path.startsWith("/api/auth")) return true;
      // cron routes check their own secret
      if (path.startsWith("/api/cron")) return true;

      const publicPaths = ["/", "/login"];
      const isPublic = publicPaths.some((p) => path === p || path.startsWith(p + "/"));
      if (!user) return isPublic || path === "/pending";

      // the approval gate: a signed-in account that no teacher approved yet
      // (or that was blocked) sees only /pending — pages and APIs alike
      const gated = user.role !== "teacher" && user.approved !== true;
      if (gated) {
        if (path === "/pending") return true;
        return Response.redirect(new URL("/pending", request.nextUrl));
      }
      if (path === "/pending") return Response.redirect(new URL("/", request.nextUrl));
      return true;
    },
    // Expose our custom token fields on session.user so the proxy sees
    // approved/onboarded/role without another DB round-trip.
    async session({ session, token }) {
      if (session.user) {
        // a leftover guest cookie from before guest sign-in was removed:
        // treated as a blocked, non-teacher account — it can only sign out
        const stale = Boolean(token.guest) || !token.userId;
        session.user.id = String(token.userId ?? "");
        session.user.role = stale ? "student" : ((token.role as string | undefined) ?? "student");
        session.user.fullName = (token.fullName as string | null | undefined) ?? null;
        session.user.addressForm = (token.addressForm as string | null | undefined) ?? null;
        session.user.onboarded = Boolean(token.onboarded);
        session.user.approved = stale ? false : Boolean(token.approved);
        session.user.blocked = stale ? true : Boolean(token.blocked);
        session.user.guest = false;
        session.user.guestMode = undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
