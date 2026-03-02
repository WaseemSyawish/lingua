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
      where: { userId, messageCount: { gt: 0 } },
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
        focusConcepts: s.focusConcepts,
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

    const validTypes = ["LESSON", "FREE_CONVERSATION", "REVIEW", "PLACEMENT", "READING", "WRITING"];
    const resolvedType = validTypes.includes(sessionType) ? sessionType : "LESSON";

    const aiModel = resolvedType === "PLACEMENT" ? "gpt-4o" : "gpt-4o-mini";

    // Retry loop to handle race conditions on the unique [userId, sessionNumber] constraint
    let attempts = 0;
    while (attempts < 3) {
      try {
        const lastSession = await prisma.conversationSession.findFirst({
          where: { userId },
          orderBy: { sessionNumber: "desc" },
          select: { sessionNumber: true },
        });

        const sessionNumber = (lastSession?.sessionNumber ?? 0) + 1;

        const newSession = await prisma.conversationSession.create({
          data: {
            userId,
            sessionNumber,
            sessionType: resolvedType as SessionType,
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
      } catch (err: any) {
        // P2002 = unique constraint violation — retry with a fresh sessionNumber
        if (err?.code === "P2002" && attempts < 2) {
          attempts++;
          continue;
        }
        console.error("Session create error:", err);
        return res.status(500).json({ error: "Failed to create session", detail: err?.message });
      }
    }

    return res.status(500).json({ error: "Failed to create session after retries" });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
