import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { STORE_ITEMS } from "@/lib/store-constants";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).json({ error: "Unauthorized" });

  const userId = session.user.id;

  // GET — fetch store state (coins, purchases, items)
  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, xpLevel: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    const purchases = await prisma.storePurchase.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const purchasedIds = purchases.map((p) => p.itemId);

    // Enrich items with purchase/availability status
    const items = STORE_ITEMS.map((item) => ({
      ...item,
      owned: item.oneTime && purchasedIds.includes(item.id),
      purchaseCount: purchases.filter((p) => p.itemId === item.id).length,
      canAfford: user.coins >= item.cost,
      levelLocked: user.xpLevel < item.levelRequired,
    }));

    return res.json({
      coins: user.coins,
      level: user.xpLevel,
      items,
      recentPurchases: purchases.slice(0, 10).map((p) => ({
        itemId: p.itemId,
        cost: p.cost,
        date: p.createdAt,
      })),
    });
  }

  // POST — purchase an item
  if (req.method === "POST") {
    const { itemId } = req.body;
    if (!itemId) return res.status(400).json({ error: "Missing itemId" });

    const item = STORE_ITEMS.find((i) => i.id === itemId);
    if (!item) return res.status(404).json({ error: "Item not found" });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { coins: true, xpLevel: true },
    });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Validation
    if (user.xpLevel < item.levelRequired) {
      return res.status(403).json({ error: `Requires level ${item.levelRequired}` });
    }
    if (user.coins < item.cost) {
      return res.status(403).json({ error: "Not enough coins", needed: item.cost, have: user.coins });
    }

    // Check if one-time item already owned
    if (item.oneTime) {
      const existing = await prisma.storePurchase.findFirst({
        where: { userId, itemId },
      });
      if (existing) return res.status(409).json({ error: "Already owned" });
    }

    // Execute purchase in transaction
    const [updatedUser, purchase] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { coins: { decrement: item.cost } },
        select: { coins: true },
      }),
      prisma.storePurchase.create({
        data: {
          userId,
          itemId: item.id,
          cost: item.cost,
        },
      }),
    ]);

    return res.json({
      success: true,
      coins: updatedUser.coins,
      purchase: {
        itemId: purchase.itemId,
        cost: purchase.cost,
        date: purchase.createdAt,
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
