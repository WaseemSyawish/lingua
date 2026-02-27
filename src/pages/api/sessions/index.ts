import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SessionType } from "@/generated/prisma/enums";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.user.id;

  if (req.method === "GET") {
    const sessions = await prisma.conversationSession.findMany({
      where: { userId },
      orderBy: { startedAt: "desc" },
      take: 50,
      include: {
        summary: true,
      },
    });

    return res.json({
      sessions: sessions.map((s) => ({
        id: s.id,
        sessionNumber: s.sessionNumber,
        sessionType: s.sessionType,
        messageCount: s.messageCount,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        summary: s.summary
          ? {
              topicsCovered: s.summary.topicsCovered,
              overallNotes: s.summary.overallNotes,
            }
          : null,
      })),
    });
  }

  if (req.method === "POST") {
    const { sessionType = "LESSON" } = req.body;

    // Get next session number
    const lastSession = await prisma.conversationSession.findFirst({
      where: { userId },
      orderBy: { sessionNumber: "desc" },
      select: { sessionNumber: true },
    });

    const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

    const aiModel =
      sessionType === "PLACEMENT"
        ? "claude-sonnet-4-20250514"
        : "claude-haiku-4-20250414";

    const newSession = await prisma.conversationSession.create({
      data: {
        userId,
        sessionNumber,
        sessionType: sessionType as SessionType,
        aiModel,
      },
    });

    return res.status(201).json({
      session: {
        id: newSession.id,
        sessionNumber: newSession.sessionNumber,
        sessionType: newSession.sessionType,
        startedAt: newSession.startedAt,
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
