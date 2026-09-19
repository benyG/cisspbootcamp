import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

import { isAdminEmail } from "@/lib/admin";
import { env } from "@/lib/env";

/**
 * Admin authentication (SPECS: Ben is the only admin in V1).
 *
 * No public account exists in V1, so there is no user table and no adapter:
 * the session is a JWT, and exactly one Google address is allowed in.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: env.AUTH_GOOGLE_ID,
      clientSecret: env.AUTH_GOOGLE_SECRET,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/admin/connexion", error: "/admin/connexion" },
  callbacks: {
    /** The single gate: any other Google account is rejected. */
    signIn({ profile }) {
      return isAdminEmail(profile?.email, env.ADMIN_EMAIL);
    },
    /**
     * Re-checked on every request: a session minted before ADMIN_EMAIL changed
     * must not keep working.
     */
    session({ session }) {
      if (!isAdminEmail(session.user?.email, env.ADMIN_EMAIL)) {
        throw new Error("Session non autorisée");
      }
      return session;
    },
  },
});
