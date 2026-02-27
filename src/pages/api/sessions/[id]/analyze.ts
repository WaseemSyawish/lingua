import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { MessageRole, ConceptType, CEFRLevel } from "@/generated/prisma/enums";
import { analysisRateLimit } from "@/lib/rate-limit";

const SESSION_ANALYSIS_PROMPT = `You are an expert French language tutor analyzing a lesson session. Review the conversation and provide a structured analysis.

Respond in EXACTLY this JSON format:
{
  "topicsCovered": "Brief description of what was discussed",
  "vocabularyIntroduced": "Comma-separated list of new French words/phrases used",
  "grammarPracticed": "Comma-separated list of grammar structures practiced",
  "errorsObserved": "Description of notable errors the learner made",
  "overallNotes": "Brief assessment of the learner's performance in this session",
  "conceptScores": [
    {
      "conceptId": "string matching one of the focus concepts",
      "score": 0.0-1.0,
      "notes": "Brief note on performance for this concept"
    }
  ],
  "suggestedFocus": ["conceptId1", "conceptId2"]
}

Focus concepts for this session (score each one that was practiced):
FOCUS_CONCEPTS_PLACEHOLDER

Be specific and constructive. Score 0.0 means no evidence of understanding, 0.5 means partial, 1.0 means demonstrated mastery.`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!analysisRateLimit(req, res)) return;

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    const convSession = await prisma.conversationSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!convSession) {
      return res.status(404).json({ error: "Session not found" });
    }

    // Only analyze sessions with enough messages
    if (convSession.messages.length < 4) {
      return res.status(400).json({ error: "Session too short to analyze" });
    }

    // Build conversation text
    const conversationText = convSession.messages
      .map((msg) => {
        const role = msg.role === MessageRole.USER ? "Learner" : "Tutor";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    // Build the prompt with focus concepts
    const focusConceptsText =
      convSession.focusConcepts.length > 0
        ? convSession.focusConcepts.join(", ")
        : "No specific focus concepts — identify any concepts practiced";

    const prompt = SESSION_ANALYSIS_PROMPT.replace(
      "FOCUS_CONCEPTS_PLACEHOLDER",
      focusConceptsText
    );

    // Analyze with Claude
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n--- CONVERSATION ---\n${conversationText}\n--- END CONVERSATION ---`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    let analysis;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse session analysis:", responseText);
      return res.status(500).json({ error: "Failed to analyze session" });
    }

    // Save session summary
    await prisma.sessionSummary.upsert({
      where: { sessionId },
      update: {
        topicsCovered: analysis.topicsCovered || "",
        vocabularyIntroduced: analysis.vocabularyIntroduced || "",
        grammarPracticed: analysis.grammarPracticed || "",
        errorsObserved: analysis.errorsObserved || "",
        overallNotes: analysis.overallNotes || "",
      },
      create: {
        sessionId,
        topicsCovered: analysis.topicsCovered || "",
        vocabularyIntroduced: analysis.vocabularyIntroduced || "",
        grammarPracticed: analysis.grammarPracticed || "",
        errorsObserved: analysis.errorsObserved || "",
        overallNotes: analysis.overallNotes || "",
      },
    });

    // Update concept mastery scores
    if (analysis.conceptScores && Array.isArray(analysis.conceptScores)) {
      for (const cs of analysis.conceptScores) {
        if (!cs.conceptId || typeof cs.score !== "number") continue;

        const conceptType = cs.conceptId.startsWith("grammar.")
          ? ConceptType.GRAMMAR
          : cs.conceptId.startsWith("vocab.")
            ? ConceptType.VOCABULARY
            : cs.conceptId.startsWith("pronunciation.")
              ? ConceptType.PRONUNCIATION
              : cs.conceptId.startsWith("culture.")
                ? ConceptType.CULTURE
                : ConceptType.PRAGMATICS;

        // Get existing mastery
        const existing = await prisma.conceptMastery.findUnique({
          where: {
            userId_conceptId: {
              userId: session.user.id,
              conceptId: cs.conceptId,
            },
          },
        });

        if (existing) {
          // Update with exponential moving average
          const alpha = 0.3; // Weight for new score
          const newScore =
            alpha * cs.score + (1 - alpha) * existing.masteryScore;

          await prisma.conceptMastery.update({
            where: {
              userId_conceptId: {
                userId: session.user.id,
                conceptId: cs.conceptId,
              },
            },
            data: {
              masteryScore: Math.min(1, Math.max(0, newScore)),
              practiceCount: { increment: 1 },
              lastPracticed: new Date(),
            },
          });
        } else {
          // Create new mastery entry
          await prisma.conceptMastery.create({
            data: {
              userId: session.user.id,
              conceptId: cs.conceptId,
              conceptType,
              masteryScore: cs.score * 0.7, // Discount first observation
              practiceCount: 1,
              lastPracticed: new Date(),
            },
          });
        }
      }
    }

    return res.json({
      summary: {
        topicsCovered: analysis.topicsCovered,
        vocabularyIntroduced: analysis.vocabularyIntroduced,
        grammarPracticed: analysis.grammarPracticed,
        errorsObserved: analysis.errorsObserved,
        overallNotes: analysis.overallNotes,
      },
      conceptScores: analysis.conceptScores || [],
      suggestedFocus: analysis.suggestedFocus || [],
    });
  } catch (error: any) {
    console.error("Session analysis error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
