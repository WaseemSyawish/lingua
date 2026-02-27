import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { CEFRLevel, SessionType, MessageRole } from "@/generated/prisma/enums";
import { buildSystemPrompt } from "@/services/prompt-builder";
import {
  getRecentSessionSummaries,
  selectSessionFocusConcepts,
} from "@/services/conversation-memory";
import { getAllConceptIds } from "@/curriculum";
import { chatRateLimit } from "@/lib/rate-limit";

export const config = {
  api: {
    bodyParser: true,
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!chatRateLimit(req, res)) return;

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId, message } = req.body;

  if (!sessionId || !message || typeof message !== "string") {
    return res.status(400).json({ error: "sessionId and message are required" });
  }

  try {
    // Fetch the conversation session
    const convSession = await prisma.conversationSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!convSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (convSession.endedAt) {
      return res.status(400).json({ error: "Session has ended" });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { skillProfile: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const level = user.skillProfile?.currentLevel ?? CEFRLevel.A0;

    // Build system prompt if not already cached in session
    let systemPrompt: string;

    if (convSession.messages.length === 0) {
      // First message in session — build full system prompt
      const [summaries, focusConcepts] = await Promise.all([
        getRecentSessionSummaries(user.id, 3),
        convSession.sessionType !== SessionType.PLACEMENT
          ? selectSessionFocusConcepts(user.id, level, getAllConceptIds(level))
          : Promise.resolve([]),
      ]);

      systemPrompt = buildSystemPrompt({
        level,
        sessionType: convSession.sessionType,
        focusConcepts,
        conversationSummaries: summaries,
        userName: user.name || undefined,
      });

      // Store focus concepts in session metadata
      if (focusConcepts.length > 0) {
        await prisma.conversationSession.update({
          where: { id: sessionId },
          data: {
            focusConcepts: focusConcepts,
          },
        });
      }
    } else {
      // Rebuild system prompt from existing context
      const summaries = await getRecentSessionSummaries(user.id, 3);
      systemPrompt = buildSystemPrompt({
        level,
        sessionType: convSession.sessionType,
        focusConcepts: convSession.focusConcepts,
        conversationSummaries: summaries,
        userName: user.name || undefined,
      });
    }

    // Save user message to database
    await prisma.conversationMessage.create({
      data: {
        sessionId: convSession.id,
        role: MessageRole.USER,
        content: message,
      },
    });

    // Build messages array for Anthropic
    const historyMessages = convSession.messages.map((msg) => ({
      role: msg.role === MessageRole.USER ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    // Add the new user message
    historyMessages.push({
      role: "user" as const,
      content: message,
    });

    // Trim history to last 40 messages to stay within context limits
    const trimmedHistory = historyMessages.slice(-40);

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Stream from Anthropic
    let fullResponse = "";

    try {
      const stream = anthropic.messages.stream({
        model: convSession.aiModel || "claude-haiku-4-20250414",
        max_tokens: 1024,
        system: systemPrompt,
        messages: trimmedHistory,
      });

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          const text = event.delta.text;
          fullResponse += text;

          // Send as SSE
          res.write(`data: ${JSON.stringify({ type: "delta", text })}\n\n`);
        }
      }

      // Save assistant message to database
      await prisma.conversationMessage.create({
        data: {
          sessionId: convSession.id,
          role: MessageRole.ASSISTANT,
          content: fullResponse,
        },
      });

      // Update session message count
      await prisma.conversationSession.update({
        where: { id: sessionId },
        data: {
          messageCount: { increment: 2 }, // user + assistant
        },
      });

      // Send done event
      res.write(
        `data: ${JSON.stringify({ type: "done", messageId: Date.now().toString() })}\n\n`
      );
    } catch (streamError: any) {
      console.error("Streaming error:", streamError);
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          error: "An error occurred while generating a response. Please try again.",
        })}\n\n`
      );
    }

    res.end();
  } catch (error: any) {
    console.error("Chat API error:", error);
    // If headers were already sent (SSE started), try to send error event
    if (res.headersSent) {
      res.write(
        `data: ${JSON.stringify({ type: "error", error: "Internal server error" })}\n\n`
      );
      res.end();
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
