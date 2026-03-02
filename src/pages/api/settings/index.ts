import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        name: true,
        email: true,
        nativeLanguage: true,
        targetLanguage: true,
        currentCEFRLevel: true,
        placementCompleted: true,
        createdAt: true,
        passwordHash: true,
        xp: true,
        xpLevel: true,
        accounts: {
          select: {
            provider: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.json({
      user: {
        name: user.name,
        email: user.email,
        nativeLanguage: user.nativeLanguage,
        targetLanguage: user.targetLanguage,
        currentCEFRLevel: user.currentCEFRLevel,
        placementCompleted: user.placementCompleted,
        createdAt: user.createdAt,
        xp: user.xp,
        xpLevel: user.xpLevel,
        hasPassword: !!user.passwordHash,
        connectedAccounts: user.accounts.map((a) => ({
          provider: a.provider,
          type: a.type,
        })),
      },
    });
  }

  if (req.method === "PATCH") {
    const { name, targetLanguage, nativeLanguage, currentPassword, newPassword } = req.body;

    // Handle password change (has existing password)
    if (currentPassword && newPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (!user?.passwordHash) {
        return res.status(400).json({ error: "Account does not use password authentication" });
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        return res.status(400).json({ error: "Current password is incorrect" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "New password must be at least 8 characters" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      });

      return res.json({ success: true, message: "Password updated successfully" });
    }

    // Handle creating a new password (OAuth users or accounts without one)
    if (!currentPassword && newPassword) {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { passwordHash: true },
      });

      if (user?.passwordHash) {
        return res.status(400).json({ error: "Current password required to update an existing password" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
      return res.json({ success: true, message: "Password created successfully" });
    }

    const updateData: Record<string, any> = {};
    if (name && typeof name === "string" && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (targetLanguage && ["fr", "es", "de"].includes(targetLanguage)) {
      updateData.targetLanguage = targetLanguage;
    }
    if (nativeLanguage && typeof nativeLanguage === "string") {
      updateData.nativeLanguage = nativeLanguage;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        name: true,
        email: true,
        nativeLanguage: true,
        targetLanguage: true,
        currentCEFRLevel: true,
      },
    });

    return res.json({ user });
  }

  if (req.method === "DELETE") {
    // Delete account and all associated data (cascade)
    await prisma.user.delete({ where: { id: userId } });
    return res.json({ success: true });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
