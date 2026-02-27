import { CEFRLevel } from "@/generated/prisma/enums";

// Extend next-auth session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      image?: string;
      cefrLevel: CEFRLevel;
      placementCompleted: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    cefrLevel: CEFRLevel;
    placementCompleted: boolean;
  }
}
