import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAllConceptIds } from "@/curriculum";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [profile, masteries, sessions, levelHistory] = await Promise.all([
      prisma.skillProfile.findUnique({
        where: { userId: session.user.id },
      }),
      prisma.conceptMastery.findMany({
        where: { userId: session.user.id },
        orderBy: { masteryScore: "desc" },
      }),
      prisma.conversationSession.findMany({
        where: { userId: session.user.id },
        orderBy: { startedAt: "desc" },
        take: 30,
        select: {
          id: true,
          sessionNumber: true,
          sessionType: true,
          messageCount: true,
          startedAt: true,
          endedAt: true,
        },
      }),
      prisma.levelHistory.findMany({
        where: { userId: session.user.id },
        orderBy: { changedAt: "desc" },
      }),
    ]);

    if (!profile) {
      return res.json({
        profile: null,
        masteries: [],
        recentSessions: [],
        levelHistory: [],
        stats: {
          totalSessions: 0,
          totalMessages: 0,
          currentStreak: 0,
          conceptsMastered: 0,
          levelProgress: 0,
        },
      });
    }

    // Calculate stats
    const totalSessions = sessions.length;
    const totalMessages = sessions.reduce((sum, s) => sum + s.messageCount, 0);

    // Calculate streak (consecutive days with sessions)
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - i);
      const nextDate = new Date(checkDate);
      nextDate.setDate(nextDate.getDate() + 1);

      const hasSession = sessions.some((s) => {
        const sessionDate = new Date(s.startedAt);
        return sessionDate >= checkDate && sessionDate < nextDate;
      });

      if (hasSession) {
        currentStreak++;
      } else if (i > 0) {
        break;
      }
    }

    // Level progress
    const levelConceptIds = getAllConceptIds(profile.currentLevel);
    const levelMasteries = masteries.filter((m) =>
      levelConceptIds.includes(m.conceptId)
    );
    const conceptsMastered = levelMasteries.filter(
      (m) => m.masteryScore >= 0.7
    ).length;
    const levelProgress =
      levelConceptIds.length > 0
        ? Math.round((conceptsMastered / levelConceptIds.length) * 100)
        : 0;

    return res.json({
      profile,
      masteries: masteries.map((m) => ({
        conceptId: m.conceptId,
        conceptType: m.conceptType,
        masteryScore: m.masteryScore,
        practiceCount: m.practiceCount,
        lastPracticed: m.lastPracticed,
      })),
      recentSessions: sessions,
      levelHistory,
      stats: {
        totalSessions,
        totalMessages,
        currentStreak,
        conceptsMastered,
        totalConceptsInLevel: levelConceptIds.length,
        levelProgress,
      },
    });
  } catch (error: any) {
    console.error("Progress API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
