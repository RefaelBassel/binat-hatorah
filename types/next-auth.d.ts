import "next-auth";
import "next-auth/jwt";

// Augment Auth.js types. We keep Session.user.id as string (matching
// DefaultUser.id's type) and carry the numeric DB id on JWT only.
declare module "next-auth" {
  interface User {
    role?: string;
    fullName?: string | null;
    addressForm?: string | null;
    onboarded?: boolean;
    guest?: boolean;
    guestMode?: string; // "student" | "full"
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: number;
    role?: string;
    fullName?: string | null;
    addressForm?: string | null;
    onboarded?: boolean;
    guest?: boolean;
    guestMode?: string;
  }
}
