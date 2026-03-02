import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { xpProgressInLevel, xpToNextLevel, LEVEL_PERKS } from "@/lib/xp";

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
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { xp: true, xpLevel: true, coins: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const progress = xpProgressInLevel(user.xp, user.xpLevel);
    const unlockedPerks = LEVEL_PERKS.filter((p) => user.xpLevel >= p.level);
    const nextPerk = LEVEL_PERKS.find((p) => user.xpLevel < p.level) || null;

    // Recent XP transactions (last 20)
    const recentTransactions = await prisma.xpTransaction.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        amount: true,
        source: true,
        description: true,
        createdAt: true,
      },
    });

    return res.json({
      xp: user.xp,
      level: user.xpLevel,
      coins: user.coins,
      progress,
      xpToNext: xpToNextLevel(user.xpLevel),
      unlockedPerks,
      nextPerk,
      recentTransactions,
    });
  } catch (error: any) {
    console.error("XP API error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
