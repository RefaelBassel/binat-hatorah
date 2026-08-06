import NextAuth, { type User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { db } from "@/lib/db";
import { roleForEmail } from "@/lib/roles";

// Dev-only login: any email → find-or-create a user row, no Google needed.
// Registered ONLY when not in production; used to test student flows locally.
const devProvider = Credentials({
  id: "dev",
  name: "Dev",
  credentials: { email: { label: "email" }, name: { label: "name" } },
  authorize: async (creds) => {
    if (process.env.NODE_ENV === "production") return null;
    const email = String(creds?.email ?? "").toLowerCase().trim();
    if (!email) return null;
    const fullName = String(creds?.name ?? "").trim() || null;
    const role = roleForEmail(email);
    const now = Math.floor(Date.now() / 1000);
    const existing = await db().execute({
      sql: "SELECT id FROM users WHERE email = ?",
      args: [email],
    });
    if (existing.rows.length === 0) {
      await db().execute({
        sql: `INSERT INTO users (email, role, full_name, created_at, last_seen_at, onboarded_at)
              VALUES (?, ?, ?, ?, ?, ?)`,
        args: [email, role, fullName, now, now, fullName ? now : null],
      });
    } else if (fullName) {
      await db().execute({
        sql: "UPDATE users SET full_name = COALESCE(full_name, ?), onboarded_at = COALESCE(onboarded_at, ?) WHERE email = ?",
        args: [fullName, now, email],
      });
    }
    return { id: email, email, name: fullName ?? email } as User;
  },
});

// Full Auth.js config — imports DB. Must NOT be imported by middleware
// (which runs in Edge runtime). Middleware uses `auth.config.ts` only.
export const { handlers, auth, signIn, signOut, unstable_update: updateSession } = NextAuth({
  ...authConfig,
  providers: [...authConfig.providers, devProvider],
  logger: {
    error(error) {
      console.error("[next-auth] error:", error);
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      // Guest sign-in (credentials) — no DB user, read-only.
      if (user?.guest || account?.provider === "guest") return true;
      // Dev sign-in already synced the user row in authorize().
      if (account?.provider === "dev") return true;
      if (!user.email) return false;
      const email = user.email.toLowerCase();
      const role = roleForEmail(email);
      const googleId = account?.providerAccountId ?? null;
      const now = Math.floor(Date.now() / 1000);

      try {
        const existing = await db().execute({
          sql: "SELECT id, onboarded_at FROM users WHERE email = ?",
          args: [email],
        });

        if (existing.rows.length === 0) {
          await db().execute({
            sql:
              "INSERT INTO users (email, google_id, role, created_at, last_seen_at)" +
              " VALUES (?, ?, ?, ?, ?)",
            args: [email, googleId, role, now, now],
          });
        } else {
          await db().execute({
            sql: "UPDATE users SET google_id = ?, role = ?, last_seen_at = ? WHERE email = ?",
            args: [googleId, role, now, email],
          });
        }
      } catch (err) {
        console.error("[auth.signIn] DB sync failed:", err);
        return false;
      }
      return true;
    },
    async jwt({ token, user, trigger, session }) {
      // Guest sign-in — synthetic token, no DB.
      if (user?.guest) {
        token.guest = true;
        token.guestMode = user.guestMode ?? "student";
        token.role = user.role ?? "student";
        token.userId = 0;
        token.fullName = user.name ?? "אורח/ת";
        token.onboarded = true;
        return token;
      }
      // On first sign-in (user present), load our internal row.
      if (user?.email) {
        try {
          const row = await db().execute({
            sql: "SELECT id, role, full_name, address_form, onboarded_at FROM users WHERE email = ?",
            args: [user.email.toLowerCase()],
          });
          const r = row.rows[0];
          if (r) {
            token.userId = r.id as number;
            token.role = r.role as string;
            token.fullName = (r.full_name as string | null) ?? null;
            token.addressForm = (r.address_form as string | null) ?? null;
            token.onboarded = r.onboarded_at != null;
          }
        } catch (err) {
          console.error("[auth.jwt] DB load failed:", err);
        }
      }
      // On explicit unstable_update call from a server action — merge the
      // provided session fields into the token so the cookie gets refreshed.
      if (trigger === "update" && session && typeof session === "object") {
        const s = session as {
          user?: {
            onboarded?: boolean;
            fullName?: string | null;
            addressForm?: string | null;
            role?: string;
          };
        };
        if (s.user) {
          if (typeof s.user.onboarded === "boolean") token.onboarded = s.user.onboarded;
          if (s.user.fullName !== undefined) token.fullName = s.user.fullName;
          if (s.user.addressForm !== undefined) token.addressForm = s.user.addressForm;
          if (s.user.role !== undefined) token.role = s.user.role;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.userId ?? "");
        session.user.role = token.role ?? "student";
        session.user.fullName = token.fullName ?? null;
        session.user.addressForm = token.addressForm ?? null;
        session.user.onboarded = Boolean(token.onboarded);
        session.user.guest = Boolean(token.guest);
        session.user.guestMode = token.guestMode ?? undefined;
      }
      return session;
    },
  },
});
