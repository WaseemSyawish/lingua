import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(
          credentials.password,
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
        // Single query: fetch user + their google account together
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! },
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
              email: user.email!,
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
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email! },
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
