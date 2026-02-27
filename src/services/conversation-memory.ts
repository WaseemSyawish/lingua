import { prisma } from "@/lib/prisma";
import { CEFRLevel, ConceptType } from "@/generated/prisma/enums";

/**
 * Retrieves conversation memory for building session context.
 * Returns summaries from recent sessions to maintain continuity.
 */
export async function getRecentSessionSummaries(
  userId: string,
  limit: number = 3
): Promise<string[]> {
  const sessions = await prisma.conversationSession.findMany({
    where: {
      userId,
      summary: { isNot: null },
    },
    orderBy: { startedAt: "desc" },
    take: limit,
    include: {
      summary: true,
    },
  });

  return sessions
    .filter((s) => s.summary)
    .map((s) => {
      const sum = s.summary!;
      const parts = [
        `Session #${s.sessionNumber} (${s.startedAt.toLocaleDateString()})`,
        `Type: ${s.sessionType}`,
        `Topics: ${sum.topicsCovered}`,
      ];
      if (sum.vocabularyIntroduced) {
        parts.push(`Vocabulary introduced: ${sum.vocabularyIntroduced}`);
      }
      if (sum.grammarPracticed) {
        parts.push(`Grammar practiced: ${sum.grammarPracticed}`);
      }
      if (sum.errorsObserved) {
        parts.push(`Errors observed: ${sum.errorsObserved}`);
      }
      if (sum.overallNotes) {
        parts.push(`Notes: ${sum.overallNotes}`);
      }
      return parts.join("\n");
    });
}

/**
 * Gets concepts that are due for review based on spaced repetition.
 * Uses a simple SM-2 inspired approach based on mastery score and last practice time.
 */
export async function getDueConceptsForReview(
  userId: string,
  level: CEFRLevel,
  limit: number = 5
): Promise<string[]> {
  const now = new Date();

  // Get all concept masteries for this user at their level or below
  const masteries = await prisma.conceptMastery.findMany({
    where: {
      userId,
    },
    orderBy: [
      { masteryScore: "asc" }, // Lowest mastery first
      { lastPracticed: "asc" }, // Least recently practiced first
    ],
  });

  // Calculate which concepts are due for review
  const dueConcepts: { conceptId: string; priority: number }[] = [];

  for (const mastery of masteries) {
    const daysSinceLastPractice = mastery.lastPracticed
      ? (now.getTime() - mastery.lastPracticed.getTime()) / (1000 * 60 * 60 * 24)
      : 999;

    // Interval grows with mastery score: score 0.2 = review every 1 day, score 0.8 = every 7 days
    const reviewInterval = Math.max(1, Math.pow(mastery.masteryScore * 10, 1.5));

    if (daysSinceLastPractice >= reviewInterval) {
      // Higher priority = lower mastery + more overdue
      const priority =
        (1 - mastery.masteryScore) * 3 +
        (daysSinceLastPractice / reviewInterval);
      dueConcepts.push({ conceptId: mastery.conceptId, priority });
    }
  }

  // Sort by priority (highest first) and return top N
  return dueConcepts
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((c) => c.conceptId);
}

/**
 * Gets concepts that the learner hasn't encountered yet at their current level.
 */
export async function getNewConceptsForLevel(
  userId: string,
  levelConceptIds: string[],
  limit: number = 3
): Promise<string[]> {
  const existingMasteries = await prisma.conceptMastery.findMany({
    where: {
      userId,
      conceptId: { in: levelConceptIds },
    },
    select: { conceptId: true },
  });

  const existingIds = new Set(existingMasteries.map((m) => m.conceptId));
  const newConcepts = levelConceptIds.filter((id) => !existingIds.has(id));

  return newConcepts.slice(0, limit);
}

/**
 * Select focus concepts for a session, mixing review and new material.
 */
export async function selectSessionFocusConcepts(
  userId: string,
  level: CEFRLevel,
  levelConceptIds: string[]
): Promise<string[]> {
  const [dueConcepts, newConcepts] = await Promise.all([
    getDueConceptsForReview(userId, level, 3),
    getNewConceptsForLevel(userId, levelConceptIds, 2),
  ]);

  // Mix: up to 3 review concepts + up to 2 new concepts
  const focus = [...dueConcepts.slice(0, 3), ...newConcepts.slice(0, 2)];

  // If we have no concepts at all, return empty (free conversation mode)
  return focus;
}
