import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { id } = req.query;
  if (typeof id !== "string") {
    return res.status(400).json({ error: "Invalid session ID" });
  }

  if (req.method === "GET") {
    const conversationSession = await prisma.conversationSession.findFirst({
      where: { id, userId: session.user.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
        summary: true,
      },
    });

    if (!conversationSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    return res.json({ session: conversationSession });
  }

  if (req.method === "PATCH") {
    const { action } = req.body;

    if (action === "end") {
      const conversationSession = await prisma.conversationSession.findFirst({
        where: { id, userId: session.user.id },
      });

      if (!conversationSession) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (conversationSession.endedAt) {
        return res.status(400).json({ error: "Session already ended" });
      }

      const updated = await prisma.conversationSession.update({
        where: { id },
        data: { endedAt: new Date() },
      });

      return res.json({ session: updated });
    }

    return res.status(400).json({ error: "Invalid action" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
