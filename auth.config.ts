import type { NextAuthConfig, User } from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

// Edge-safe Auth.js config. No DB imports, no node:fs — used by middleware
// (which runs in Edge runtime) and by the server-only auth.ts file which
// extends this with DB-backed callbacks.
export const authConfig = {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
    // Guest (read-only) sign-in — no Google, no DB user. Two modes:
    //   "student" → sees the student site; "full" → also the teacher dashboard.
    Credentials({
      id: "guest",
      name: "Guest",
      credentials: { mode: { label: "mode" } },
      authorize: async (creds) => {
        const mode = creds?.mode === "full" ? "full" : "student";
        return {
          id: `guest-${mode}`,
          email: `guest-${mode}@guest.local`,
          name: mode === "full" ? "אורח/ת (גישה מלאה)" : "אורח/ת (תלמיד/ה)",
          role: mode === "full" ? "teacher" : "student",
          guest: true,
          guestMode: mode,
        } as User;
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    // Route guard used by middleware. Everything deeper happens in auth.ts.
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const publicPaths = ["/", "/login", "/api/auth"];
      const isPublic = publicPaths.some(
        (p) => path === p || path.startsWith(p + "/")
      );
      if (isPublic) return true;
      return Boolean(auth?.user);
    },
    // Expose our custom token fields on session.user so middleware sees
    // onboarded/role without another DB round-trip.
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.role = (token.role as string | undefined) ?? "student";
        session.user.fullName =
          (token.fullName as string | null | undefined) ?? null;
        session.user.addressForm =
          (token.addressForm as string | null | undefined) ?? null;
        session.user.onboarded = Boolean(token.onboarded);
        session.user.guest = Boolean(token.guest);
        session.user.guestMode = (token.guestMode as string | undefined) ?? undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
