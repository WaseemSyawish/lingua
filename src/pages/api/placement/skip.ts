import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CEFRLevel } from "@/generated/prisma/enums";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Create a default skill profile at A0
    await prisma.skillProfile.upsert({
      where: { userId: session.user.id },
      update: {
        currentLevel: CEFRLevel.A0,
        placementCompletedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        currentLevel: CEFRLevel.A0,
        placementCompletedAt: new Date(),
        comprehensionScore: 0,
        vocabularyScore: 0,
        grammarScore: 0,
        fluencyScore: 0,
      },
    });

    // Create level history entry
    await prisma.levelHistory.create({
      data: {
        userId: session.user.id,
        fromLevel: CEFRLevel.A0,
        toLevel: CEFRLevel.A0,
        reason: "Skipped placement — starting as complete beginner",
      },
    });

    return res.json({ level: CEFRLevel.A0 });
  } catch (error) {
    console.error("Skip placement error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
