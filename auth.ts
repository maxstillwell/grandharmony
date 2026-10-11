import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { getPortalAccess, isBootstrapIdentity } from "@/lib/auth/access";

const googleConfigured = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: googleConfigured ? [Google] : [],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false;
      const access = await getPortalAccess(user.email);
      return Boolean(access) || isBootstrapIdentity(user.email);
    },
  },
});

export { googleConfigured };
