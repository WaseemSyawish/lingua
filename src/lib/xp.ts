/**
 * Server-side XP functions (require Prisma).
 * For client-safe constants/utilities, import from "@/lib/xp-constants".
 */
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/xp-constants";

// Re-export all client-safe utilities so existing server imports still work
export {
  xpForLevel,
  xpToNextLevel,
  calculateLevel,
  xpProgressInLevel,
  XP_SOURCES,
  LEVEL_PERKS,
  calculateSessionXp,
} from "@/lib/xp-constants";

/**
 * Award XP to a user, logging the transaction and updating level.
 * Returns the new XP total and level.
 */
export async function awardXp(
  userId: string,
  amount: number,
  source: string,
  description: string
): Promise<{ xp: number; xpLevel: number; leveledUp: boolean; previousLevel: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, xpLevel: true },
  });

  if (!user) throw new Error("User not found");

  const previousLevel = user.xpLevel;
  const newXp = user.xp + amount;
  const newLevel = calculateLevel(newXp);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { xp: newXp, xpLevel: newLevel },
    }),
    prisma.xpTransaction.create({
      data: { userId, amount, source, description },
    }),
  ]);

  return {
    xp: newXp,
    xpLevel: newLevel,
    leveledUp: newLevel > previousLevel,
    previousLevel,
  };
}

/**
 * Award coins to a user.
 */
export async function awardCoins(
  userId: string,
  amount: number
): Promise<{ coins: number }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { coins: { increment: amount } },
    select: { coins: true },
  });
  return { coins: user.coins };
}
