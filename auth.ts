import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { getPortalAccess } from "@/lib/auth/access";
import { verifyPassword } from "@/lib/auth/password";
import { getDb, isDatabaseConfigured } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const credentialsConfigured = Boolean(process.env.AUTH_SECRET);

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [Credentials({
    name: "Administrator credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
      const password = typeof credentials?.password === "string" ? credentials.password : "";
      if (!email || !password || !isDatabaseConfigured()) return null;
      const db = getDb();
      const user = await db.query.users.findFirst({ where: eq(users.email, email) });
      if (!user?.isActive || !verifyPassword(password, user.passwordHash)) return null;
      const access = await getPortalAccess(email);
      if (!access) return null;
      return { id: user.id, email: user.email, name: user.name };
    },
  })],
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
});

export { credentialsConfigured };
