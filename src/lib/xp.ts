/**
 * Server-side XP functions (require Prisma).
 * For client-safe constants/utilities, import from "@/lib/xp-constants".
 */
import { prisma } from "@/lib/prisma";
import { calculateLevel } from "@/lib/xp-constants";
import { LEVEL_UP_FREE_PERKS, STORE_ITEMS, type StoreItem } from "@/lib/store-constants";

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
): Promise<{ xp: number; xpLevel: number; leveledUp: boolean; previousLevel: number; freePerks: StoreItem[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { xp: true, xpLevel: true },
  });

  if (!user) throw new Error("User not found");

  const previousLevel = user.xpLevel;
  const newXp = user.xp + amount;
  const newLevel = calculateLevel(newXp);

  // Collect free perks for every level gained
  const freePerks: StoreItem[] = [];
  for (let lvl = previousLevel + 1; lvl <= newLevel; lvl++) {
    const perkIds = LEVEL_UP_FREE_PERKS[lvl];
    if (perkIds) {
      for (const itemId of perkIds) {
        const item = STORE_ITEMS.find((i) => i.id === itemId);
        if (item) freePerks.push(item);
      }
    }
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { xp: newXp, xpLevel: newLevel },
    }),
    prisma.xpTransaction.create({
      data: { userId, amount, source, description },
    }),
    ...freePerks.map((item) =>
      prisma.storePurchase.create({
        data: { userId, itemId: item.id, cost: 0 },
      })
    ),
  ]);

  return {
    xp: newXp,
    xpLevel: newLevel,
    leveledUp: newLevel > previousLevel,
    previousLevel,
    freePerks,
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
