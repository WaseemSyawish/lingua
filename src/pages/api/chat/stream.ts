import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/anthropic";
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

    // ── Exchange limits for all session types ──
    // Limits are for SUBSTANTIVE exchanges (user messages excluding [START_SESSION])
    const SESSION_LIMITS: Record<string, { softNudge: number; strongNudge: number; hardCap: number }> = {
      [SessionType.PLACEMENT]: { softNudge: 8, strongNudge: 10, hardCap: 12 },
      [SessionType.LESSON]: { softNudge: 9, strongNudge: 11, hardCap: 13 },
      [SessionType.FREE_CONVERSATION]: { softNudge: 12, strongNudge: 14, hardCap: 16 },
      [SessionType.REVIEW]: { softNudge: 7, strongNudge: 9, hardCap: 11 },
      [SessionType.READING]: { softNudge: 7, strongNudge: 9, hardCap: 11 },
      [SessionType.WRITING]: { softNudge: 7, strongNudge: 9, hardCap: 11 },
    };

    const limits = SESSION_LIMITS[convSession.sessionType] || { softNudge: 10, strongNudge: 12, hardCap: 14 };

    // Count substantive user messages (exclude [START_SESSION] warm intro)
    const existingUserMessages = convSession.messages.filter(
      (m) => m.role === MessageRole.USER && !m.content.startsWith("[START_SESSION]")
    ).length;
    // The current message also counts if it's not a warm intro
    const currentIsSubstantive = !message.startsWith("[START_SESSION]");
    const totalSubstantiveMessages = existingUserMessages + (currentIsSubstantive ? 1 : 0);

    // ── Hard cap: force-end the session ──
    if (totalSubstantiveMessages > limits.hardCap) {
      // Auto-close the session
      await prisma.conversationSession.update({
        where: { id: sessionId },
        data: { endedAt: new Date() },
      });

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      });
      res.write(`data: ${JSON.stringify({ type: "done", messageId: "cap" })}\n\n`);
      if (convSession.sessionType === SessionType.PLACEMENT) {
        res.write(`data: ${JSON.stringify({ type: "placement_complete" })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ type: "session_complete", sessionId })}\n\n`);
      }
      return res.end();
    }

    // Tiered nudge levels
    const isStrongNudge = totalSubstantiveMessages >= limits.strongNudge;
    const isSoftNudge = totalSubstantiveMessages >= limits.softNudge;

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { skillProfile: true },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const level = user.skillProfile?.currentLevel ?? CEFRLevel.A0;
    const targetLanguage = user.targetLanguage || "fr";
    const nativeLanguage = user.nativeLanguage || "en";

    // Build system prompt if not already cached in session
    let systemPrompt: string;

    if (convSession.messages.length === 0) {
      // First message in session — build full system prompt
      const [summaries, focusConcepts] = await Promise.all([
        getRecentSessionSummaries(user.id, 3),
        convSession.sessionType !== SessionType.PLACEMENT
          ? selectSessionFocusConcepts(user.id, level, getAllConceptIds(level, targetLanguage))
          : Promise.resolve([]),
      ]);

      systemPrompt = buildSystemPrompt({
        level,
        sessionType: convSession.sessionType,
        focusConcepts,
        conversationSummaries: summaries,
        userName: user.name || undefined,
        targetLanguage,
        nativeLanguage,
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
        targetLanguage,
        nativeLanguage,
      });
    }

    // Check if this is a warm intro request (session just started, tutor greets first)
    const isWarmIntro = message.startsWith("[START_SESSION]");
    const warmIntroContext = isWarmIntro ? message.replace("[START_SESSION]", "").trim() : "";

    // Save user message to database (skip for warm intro — tutor speaks first)
    if (!isWarmIntro) {
      await prisma.conversationMessage.create({
        data: {
          sessionId: convSession.id,
          role: MessageRole.USER,
          content: message,
        },
      });
    }

    // Build messages array for OpenAI
    const historyMessages: { role: "user" | "assistant" | "system"; content: string }[] = convSession.messages.map((msg) => ({
      role: msg.role === MessageRole.USER ? ("user" as const) : ("assistant" as const),
      content: msg.content,
    }));

    if (isWarmIntro) {
      // For warm intro, add a system nudge so the AI generates a greeting
      let warmNudge = "The learner has just entered the session. Greet them warmly and naturally. Briefly set the tone for what you'll work on together in this session type. Keep it to 2-3 sentences — friendly and inviting, not overwhelming.";
      if (warmIntroContext) {
        warmNudge += `\n\nAdditional context from the learner: ${warmIntroContext}`;
      }
      historyMessages.push({
        role: "system" as const,
        content: warmNudge,
      });
    } else {
      // Add the new user message
      historyMessages.push({
        role: "user" as const,
        content: message,
      });
    }

    // Trim history to last 40 messages to stay within context limits
    const trimmedHistory = historyMessages.slice(-40);

    // Tiered nudges — increasingly urgent, for ALL session types
    if (isStrongNudge) {
      if (convSession.sessionType === SessionType.PLACEMENT) {
        systemPrompt +=
          "\n\n=== URGENT SYSTEM OVERRIDE ===\nYou have reached the MAXIMUM number of exchanges. Your VERY NEXT response MUST be your final conclusion — no more questions. Thank the learner warmly, say you have a great picture of their level, and end with [ASSESSMENT_READY] on its own line. Do NOT ask any questions.";
      } else {
        systemPrompt +=
          `\n\n=== URGENT SYSTEM OVERRIDE ===\nYou have reached exchange ${totalSubstantiveMessages} of ${limits.hardCap - 1} maximum. Your VERY NEXT response MUST be your final closing message. Complete the wrap-up phase NOW. Summarize what was learned, celebrate specific achievements, and mention what to work on next. Your response MUST end with [SESSION_COMPLETE] on its own line. Do NOT ask any more questions.`;
      }
    } else if (isSoftNudge) {
      if (convSession.sessionType === SessionType.PLACEMENT) {
        systemPrompt +=
          "\n\n=== SYSTEM NOTE ===\nYou are approaching the end of this assessment. You should have enough data to place this learner. In your next 1-2 responses, begin wrapping up. If you are confident in your assessment, conclude now with [ASSESSMENT_READY].";
      } else {
        systemPrompt +=
          `\n\n=== SYSTEM NOTE ===\nYou are at exchange ${totalSubstantiveMessages} of ${limits.hardCap - 1} maximum. Begin wrapping up. Move to your final phase. In your next 1-2 responses, deliver the closing summary and end with [SESSION_COMPLETE]. Do not start new exercises.`;
      }
    }

    // Set up SSE
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // Stream from OpenAI (GitHub Models)
    let fullResponse = "";

    try {
      // Map to available GitHub Models — GPT-4.1 preferred for better instruction-following
      const modelMap: Record<string, string> = {
        "claude-haiku-4-20250414": "gpt-4.1-mini",
        "claude-sonnet-4-20250514": "gpt-4.1",
      };
      const model = modelMap[convSession.aiModel || ""] || "gpt-4.1-mini";

      const stream = await openai.chat.completions.create({
        model,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...trimmedHistory,
        ],
      });

      let pendingBuffer = ""; // Buffer to catch markers split across chunks

      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) {
          fullResponse += text;

          // Buffer text to handle markers split across chunks
          pendingBuffer += text;
          
          const fullMarkerPattern = /\[ASSESSMENT_READY\]|\[SESSION_COMPLETE\]/g;
          
          // If buffer ends with "[" or a partial marker start, wait for more data
          const endsWithPartial = pendingBuffer.endsWith("[") ||
            (pendingBuffer.includes("[") && 
             /\[(?:SESSION_COMPLETE|ASSESSMENT_READY|SESSION_COMPLET|SESSION_COMPLE|SESSION_COMPL|SESSION_COMP|SESSION_COM|SESSION_CO|SESSION_C|SESSION_|SESSION|SESSIO|SESSI|SESS|SES|SE|S|ASSESSMENT_READ|ASSESSMENT_REA|ASSESSMENT_RE|ASSESSMENT_R|ASSESSMENT_|ASSESSMENT|ASSESSMEN|ASSESSME|ASSESSM|ASSESS|ASSES|ASSE|ASS|AS|A)$/i.test(pendingBuffer));
          
          if (endsWithPartial) {
            continue;
          }
          
          // Strip complete markers from the buffered text
          const cleanText = pendingBuffer.replace(fullMarkerPattern, "");
          pendingBuffer = "";
          
          if (cleanText) {
            res.write(`data: ${JSON.stringify({ type: "delta", text: cleanText })}\n\n`);
          }
        }
      }
      
      // Flush any remaining buffered text (including partial markers at end of stream)
      if (pendingBuffer) {
        const fullMarkerPattern = /\[ASSESSMENT_READY\]|\[SESSION_COMPLETE\]/g;
        // Also strip partial markers that may remain at end of stream
        const partialMarkerPattern = /\[(?:SESSION_COMPLETE|ASSESSMENT_READY|SESSION_COMPLET|SESSION_COMPLE|SESSION_COMPL|SESSION_COMP|SESSION_COM|SESSION_CO|SESSION_C|SESSION_|SESSION|SESSIO|SESSI|SESS|SES|SE|ASSESSMENT_READ|ASSESSMENT_REA|ASSESSMENT_RE|ASSESSMENT_R|ASSESSMENT_|ASSESSMENT|ASSESSMEN|ASSESSME|ASSESSM|ASSESS|ASSES|ASSE|ASS|AS)$/gi;
        let cleanText = pendingBuffer.replace(fullMarkerPattern, "");
        cleanText = cleanText.replace(partialMarkerPattern, "");
        // Also strip stray opening bracket at end
        cleanText = cleanText.replace(/\[$/, "");
        if (cleanText.trim()) {
          res.write(`data: ${JSON.stringify({ type: "delta", text: cleanText })}\n\n`);
        }
      }

      // Check if the AI signaled placement assessment is ready
      const isPlacementComplete =
        convSession.sessionType === SessionType.PLACEMENT &&
        fullResponse.includes("[ASSESSMENT_READY]");

      // Check if the AI signaled session is complete (for non-placement sessions)
      const isSessionComplete =
        convSession.sessionType !== SessionType.PLACEMENT &&
        fullResponse.includes("[SESSION_COMPLETE]");

      // Strip the markers from the stored response
      const cleanResponse = fullResponse
        .replace(/\n?\[ASSESSMENT_READY\]\n?/g, "")
        .replace(/\n?\[SESSION_COMPLETE\]\n?/g, "")
        .trim();

      // Save assistant message to database
      await prisma.conversationMessage.create({
        data: {
          sessionId: convSession.id,
          role: MessageRole.ASSISTANT,
          content: cleanResponse,
        },
      });

      // Update session message count
      await prisma.conversationSession.update({
        where: { id: sessionId },
        data: {
          messageCount: { increment: isWarmIntro ? 1 : 2 }, // warm intro: assistant only; normal: user + assistant
          // Auto-close sessions when AI signals completion
          ...((isPlacementComplete || isSessionComplete) ? { endedAt: new Date() } : {}),
        },
      });

      // Send done event
      res.write(
        `data: ${JSON.stringify({ type: "done", messageId: Date.now().toString() })}\n\n`
      );

      // If AI signaled placement is complete, tell the client to auto-analyze
      if (isPlacementComplete) {
        res.write(
          `data: ${JSON.stringify({ type: "placement_complete" })}\n\n`
        );
      }

      // If AI signaled session is complete, tell the client to show summary
      if (isSessionComplete) {
        res.write(
          `data: ${JSON.stringify({ type: "session_complete", sessionId })}\n\n`
        );
      }
    } catch (streamError: any) {
      console.error("Streaming error:", streamError);

      let userMessage = "An error occurred while generating a response. Please try again.";
      if (streamError?.message?.toLowerCase().includes("credit") || streamError?.message?.toLowerCase().includes("billing")) {
        userMessage = "The AI service is unavailable due to a billing issue. Please check your GitHub token and API access.";
      } else if (streamError?.status === 401) {
        userMessage = "AI service authentication failed. Please check the GITHUB_TOKEN.";
      } else if (streamError?.status === 429) {
        userMessage = "Rate limit reached. Please wait a moment and try again.";
      } else if (streamError?.status === 529 || streamError?.status === 503) {
        userMessage = "The AI service is temporarily overloaded. Please try again in a moment.";
      } else if (process.env.NODE_ENV === "development" && streamError?.message) {
        userMessage = `AI error: ${streamError.message}`;
      }

      res.write(`data: ${JSON.stringify({ type: "error", error: userMessage })}\n\n`);
    }

    res.end();
  } catch (error: any) {
    console.error("Chat API error:", error);
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ type: "error", error: "Internal server error" })}\n\n`);
      res.end();
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
