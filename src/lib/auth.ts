import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const isProduction = process.env.NODE_ENV === "production";

// Vercel doesn't automatically set NEXTAUTH_URL — derive it from VERCEL_URL if missing.
// VERCEL_URL is auto-set by Vercel but contains no protocol prefix.
if (!process.env.NEXTAUTH_URL && process.env.VERCEL_URL) {
  process.env.NEXTAUTH_URL = `https://${process.env.VERCEL_URL}`;
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: isProduction
        ? "__Secure-next-auth.session-token"
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax" as const,
        path: "/",
        secure: isProduction,
      },
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/signin",
    newUser: "/onboarding",
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        identifier: { label: "Email or User ID", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.identifier ?? "").trim();
        const password = credentials?.password ?? "";

        if (!identifier || !password) {
          throw new Error("Email/User ID and password are required");
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { id: identifier },
              { email: identifier.toLowerCase() },
            ],
          },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (!user.passwordHash) {
          throw new Error("This account has no password. Please continue with Google.");
        }

        const isValid = await bcrypt.compare(
          password,
          user.passwordHash
        );

        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        if (!user.email) {
          return false;
        }
        // Single query: fetch user + their google account together
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          include: {
            accounts: {
              where: {
                provider: "google",
                providerAccountId: account.providerAccountId,
              },
            },
          },
        });

        const accountData = {
          type: account.type,
          provider: account.provider,
          providerAccountId: account.providerAccountId,
          refresh_token: account.refresh_token ?? null,
          access_token: account.access_token ?? null,
          expires_at: account.expires_at ?? null,
          token_type: account.token_type ?? null,
          scope: account.scope ?? null,
          id_token: account.id_token ?? null,
        };

        if (!existingUser) {
          // New user — create user + account in one transaction
          await prisma.user.create({
            data: {
              email: user.email.toLowerCase(),
              name: user.name || "Learner",
              image: user.image,
              accounts: { create: accountData },
            },
          });
        } else if (existingUser.accounts.length === 0) {
          // Existing user, first time with Google — just add the account
          await prisma.account.create({
            data: { userId: existingUser.id, ...accountData },
          });
        }
        // else: user + account already exist, nothing to do
      }
      return true;
    },
    async jwt({ token, user, trigger }) {
      if (user) {
        if (!user.email) return token;
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
          select: {
            id: true,
            name: true,
            currentCEFRLevel: true,
            placementCompleted: true,
            targetLanguage: true,
            nativeLanguage: true,
          },
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.name = dbUser.name;
          token.cefrLevel = dbUser.currentCEFRLevel;
          token.placementCompleted = dbUser.placementCompleted;
          token.targetLanguage = dbUser.targetLanguage;
          token.nativeLanguage = dbUser.nativeLanguage;
        }
      }
      // When the client calls update(), refresh from DB
      if (trigger === "update" && token.userId) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: {
            name: true,
            currentCEFRLevel: true,
            placementCompleted: true,
            targetLanguage: true,
            nativeLanguage: true,
          },
        });
        if (dbUser) {
          token.name = dbUser.name;
          token.cefrLevel = dbUser.currentCEFRLevel;
          token.placementCompleted = dbUser.placementCompleted;
          token.targetLanguage = dbUser.targetLanguage;
          token.nativeLanguage = dbUser.nativeLanguage;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.userId as string;
        if (token.name) session.user.name = token.name as string;
        (session.user as any).cefrLevel = token.cefrLevel as string;
        (session.user as any).placementCompleted =
          token.placementCompleted as boolean;
        (session.user as any).targetLanguage =
          (token.targetLanguage as string) || "fr";
        (session.user as any).nativeLanguage =
          (token.nativeLanguage as string) || "en";
      }
      return session;
    },
  },
};
