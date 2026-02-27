import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CEFRLevel } from "@/generated/prisma/enums";
import { getAllConceptIds } from "@/curriculum";
import { CEFR_ORDER, cefrToIndex } from "@/lib/utils";

/**
 * Checks if the user should level up or down based on their mastery scores.
 * Called periodically (e.g., after every 5 sessions).
 */
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
    const profile = await prisma.skillProfile.findUnique({
      where: { userId: session.user.id },
    });

    if (!profile) {
      return res.status(404).json({ error: "No skill profile found" });
    }

    const currentLevel = profile.currentLevel;
    const currentIndex = cefrToIndex(currentLevel);
    const conceptIds = getAllConceptIds(currentLevel);

    // Get mastery scores for current level concepts
    const masteries = await prisma.conceptMastery.findMany({
      where: {
        userId: session.user.id,
        conceptId: { in: conceptIds },
      },
    });

    // Calculate average mastery
    const totalConcepts = conceptIds.length;
    const masteredConcepts = masteries.filter((m) => m.masteryScore >= 0.7);
    const averageMastery =
      masteries.length > 0
        ? masteries.reduce((sum, m) => sum + m.masteryScore, 0) / masteries.length
        : 0;
    const coverage = masteries.length / totalConcepts; // % of concepts practiced

    let levelChange: "up" | "down" | "none" = "none";
    let newLevel = currentLevel;
    let reason = "";

    // Level up criteria: ≥70% of concepts practiced AND average mastery ≥0.75 AND ≥60% concepts mastered
    if (
      coverage >= 0.7 &&
      averageMastery >= 0.75 &&
      masteredConcepts.length / totalConcepts >= 0.6 &&
      currentIndex < CEFR_ORDER.length - 1
    ) {
      levelChange = "up";
      newLevel = CEFR_ORDER[currentIndex + 1] as CEFRLevel;
      reason = `Achieved ${Math.round(coverage * 100)}% coverage with ${Math.round(averageMastery * 100)}% average mastery at ${currentLevel}`;
    }

    // Level down criteria: after ≥50% coverage, average mastery < 0.3
    // Only if they've been practicing enough to have meaningful data
    if (
      coverage >= 0.5 &&
      averageMastery < 0.3 &&
      masteries.length >= 5 &&
      currentIndex > 0
    ) {
      levelChange = "down";
      newLevel = CEFR_ORDER[currentIndex - 1] as CEFRLevel;
      reason = `Struggling at ${currentLevel} with ${Math.round(averageMastery * 100)}% average mastery after ${masteries.length} concepts practiced`;
    }

    // Apply level change
    if (levelChange !== "none") {
      await prisma.skillProfile.update({
        where: { userId: session.user.id },
        data: { currentLevel: newLevel },
      });

      await prisma.levelHistory.create({
        data: {
          userId: session.user.id,
          fromLevel: currentLevel,
          toLevel: newLevel,
          reason,
        },
      });
    }

    return res.json({
      currentLevel,
      newLevel,
      levelChange,
      reason,
      stats: {
        totalConcepts,
        conceptsPracticed: masteries.length,
        coverage: Math.round(coverage * 100),
        averageMastery: Math.round(averageMastery * 100),
        masteredCount: masteredConcepts.length,
      },
    });
  } catch (error: any) {
    console.error("Level assessment error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
