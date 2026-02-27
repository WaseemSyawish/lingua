import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { anthropic } from "@/lib/anthropic";
import { CEFRLevel, MessageRole, SessionType } from "@/generated/prisma/enums";

const PLACEMENT_ANALYSIS_PROMPT = `You are an expert French language assessor. Analyze the following conversation between a language tutor and a learner to determine the learner's CEFR French level.

Evaluate these dimensions:
1. COMPREHENSION: Could they understand French at various complexity levels?
2. VOCABULARY RANGE: How varied and precise was their word choice?
3. GRAMMAR ACCURACY: Verb conjugations, agreements, sentence structure correctness.
4. FLUENCY: Could they form sentences smoothly?
5. CULTURAL AWARENESS: Did they understand idioms or cultural references?

CEFR Level Descriptions:
- A0: No French knowledge at all. Only responded in English.
- A1: Can use very basic French phrases (greetings, simple present tense, basic vocabulary).
- A2: Can handle simple daily situations. Uses past tense, basic descriptions, simple questions.
- B1: Can discuss familiar topics. Uses some complex structures (subjunctive, conditional). Can express opinions.
- B2: Can engage in detailed discussion. Good accuracy, varied vocabulary, handles nuance.
- C1: Near-native fluency. Handles abstract topics, literary language, subtle cultural references.
- C2: Mastery level. Indistinguishable from educated native speaker in this context.

IMPORTANT: Be conservative in your assessment. When in doubt, place them at the lower level. It's better to place slightly lower and let them advance than to overwhelm them.

Respond in EXACTLY this JSON format and nothing else:
{
  "level": "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "confidence": 0.0-1.0,
  "comprehension": 0.0-1.0,
  "vocabulary": 0.0-1.0,
  "grammar": 0.0-1.0,
  "fluency": 0.0-1.0,
  "culturalAwareness": 0.0-1.0,
  "reasoning": "Brief explanation of the placement decision",
  "strengths": ["strength1", "strength2"],
  "areasToImprove": ["area1", "area2"]
}`;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    // Get the placement session
    const convSession = await prisma.conversationSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
        sessionType: SessionType.PLACEMENT,
      },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!convSession) {
      return res.status(404).json({ error: "Placement session not found" });
    }

    // Build conversation text for analysis
    const conversationText = convSession.messages
      .map((msg) => {
        const role = msg.role === MessageRole.USER ? "Learner" : "Tutor";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");

    // Analyze with Claude Sonnet (more capable model for analysis)
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `${PLACEMENT_ANALYSIS_PROMPT}\n\n--- CONVERSATION ---\n${conversationText}\n--- END CONVERSATION ---`,
        },
      ],
    });

    const responseText =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Parse the JSON response
    let analysis;
    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("Failed to parse placement analysis:", responseText);
      return res.status(500).json({ error: "Failed to analyze placement" });
    }

    const placedLevel = analysis.level as CEFRLevel;

    // Validate the level is a valid CEFRLevel
    if (!Object.values(CEFRLevel).includes(placedLevel)) {
      return res.status(500).json({ error: "Invalid level from analysis" });
    }

    // Update user's skill profile
    await prisma.skillProfile.upsert({
      where: { userId: session.user.id },
      update: {
        currentLevel: placedLevel,
        placementCompletedAt: new Date(),
        comprehensionScore: analysis.comprehension,
        vocabularyScore: analysis.vocabulary,
        grammarScore: analysis.grammar,
        fluencyScore: analysis.fluency,
      },
      create: {
        userId: session.user.id,
        currentLevel: placedLevel,
        placementCompletedAt: new Date(),
        comprehensionScore: analysis.comprehension,
        vocabularyScore: analysis.vocabulary,
        grammarScore: analysis.grammar,
        fluencyScore: analysis.fluency,
      },
    });

    // End the placement session
    await prisma.conversationSession.update({
      where: { id: sessionId },
      data: { endedAt: new Date() },
    });

    // Create a level history entry
    await prisma.levelHistory.create({
      data: {
        userId: session.user.id,
        fromLevel: CEFRLevel.A0,
        toLevel: placedLevel,
        reason: `Placement assessment: ${analysis.reasoning}`,
      },
    });

    return res.json({
      level: placedLevel,
      analysis: {
        confidence: analysis.confidence,
        comprehension: analysis.comprehension,
        vocabulary: analysis.vocabulary,
        grammar: analysis.grammar,
        fluency: analysis.fluency,
        culturalAwareness: analysis.culturalAwareness,
        reasoning: analysis.reasoning,
        strengths: analysis.strengths,
        areasToImprove: analysis.areasToImprove,
      },
    });
  } catch (error: any) {
    console.error("Placement analysis error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
