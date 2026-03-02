import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/anthropic";
import { MessageRole, ConceptType, CEFRLevel } from "@/generated/prisma/enums";
import { analysisRateLimit } from "@/lib/rate-limit";
import { getConceptName } from "@/curriculum";
import { awardXp, awardCoins, calculateSessionXp } from "@/lib/xp";

function buildAnalysisPrompt(targetLanguage: string): string {
  const langNames: Record<string, string> = {
    fr: "French",
    es: "Spanish",
    de: "German",
  };
  const langName = langNames[targetLanguage] || "French";

  return `You are an expert ${langName} language tutor analyzing a lesson session. Review EVERY learner message individually to assess concept usage.

For each focus concept, evaluate each learner message and categorize usage as:
- "correct_unprompted": Learner used the concept correctly WITHOUT being explicitly prompted to use it
- "correct_prompted": Learner used the concept correctly AFTER being asked to use it or given an exercise
- "incorrect": Learner attempted the concept but made an error
- "avoided": Learner did not use the concept in this message (neither correct nor incorrect)

Respond in EXACTLY this JSON format:
{
  "topicsCovered": "Brief description of what was discussed",
  "vocabularyIntroduced": "Comma-separated list of new ${langName} words/phrases used",
  "grammarPracticed": "Comma-separated list of grammar structures practiced",
  "errorsObserved": "Description of notable errors the learner made",
  "overallNotes": "Brief honest assessment — what the learner genuinely did well and what needs work",
  "conceptEvaluations": [
    {
      "conceptId": "string matching one of the focus concepts",
      "correctUnprompted": 0,
      "correctPrompted": 0,
      "incorrect": 0,
      "evidence": "Specific examples from the conversation showing performance",
      "progressLabel": "one of: struggling | making_progress | getting_comfortable | strong"
    }
  ],
  "sessionHighlights": {
    "didWell": ["Specific thing the learner did well, with examples from the conversation"],
    "focusNextTime": ["Specific thing to focus on next time"],
    "tutorClosingNote": "A warm, personalized 1-2 sentence note from the tutor referencing specific moments from this session"
  },
  "suggestedFocus": ["conceptId1", "conceptId2"]
}

Focus concepts for this session (evaluate each one):
FOCUS_CONCEPTS_PLACEHOLDER

SCORING RULES:
- Count EACH learner message separately. One message can have multiple correct/incorrect uses.
- "correct_unprompted" means the learner voluntarily used the structure without being asked.
- "correct_prompted" means the learner was doing an exercise or responding to a direct prompt about the concept.
- "incorrect" means any attempt that contains an error in that concept (even if partially correct).
- Be honest. Do NOT inflate scores. A learner who gets 2 correct and 2 incorrect is "making_progress", not "strong".
- "progressLabel" guidelines: 0-25% correct = struggling, 25-50% = making_progress, 50-75% = getting_comfortable, 75%+ = strong`;
}

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

  // Use the route param [id] — the client calls POST /api/sessions/:id/analyze
  const sessionId = req.query.id as string;

  if (!sessionId) {
    return res.status(400).json({ error: "sessionId is required" });
  }

  try {
    // Get user's target language
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { targetLanguage: true },
    });
    const targetLanguage = user?.targetLanguage || "fr";

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
      return res.status(400).json({
        error: "Session too short to analyze",
        detail: "At least 4 messages are needed for meaningful analysis.",
      });
    }

    // Build conversation text with numbered learner messages for precise evaluation
    let learnerMsgIndex = 0;
    const conversationText = convSession.messages
      .map((msg) => {
        if (msg.role === MessageRole.USER) {
          // Skip the warm intro marker
          if (msg.content === "[START_SESSION]") return null;
          learnerMsgIndex++;
          return `Learner [msg ${learnerMsgIndex}]: ${msg.content}`;
        }
        return `Tutor: ${msg.content}`;
      })
      .filter(Boolean)
      .join("\n\n");

    // Build the prompt with focus concepts using human-readable names
    const focusConceptsText =
      convSession.focusConcepts.length > 0
        ? convSession.focusConcepts
            .map((c) => `${c} (${getConceptName(c, targetLanguage)})`)
            .join(", ")
        : "No specific focus concepts — identify any concepts practiced";

    const prompt = buildAnalysisPrompt(targetLanguage).replace(
      "FOCUS_CONCEPTS_PLACEHOLDER",
      focusConceptsText
    );

    // Analyze with GPT-4o (via GitHub Models)
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\n--- CONVERSATION ---\n${conversationText}\n--- END CONVERSATION ---`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content ?? "";

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

    // ── New delta-based mastery scoring ──
    // +0.15 per correct unprompted use
    // +0.05 per correct prompted use
    // -0.10 per incorrect use
    // 0 for avoided
    // Mastery threshold (0.75) requires minimum 3 sessions with evidence
    const conceptResults: Array<{
      conceptId: string;
      previousScore: number;
      newScore: number;
      delta: number;
      progressLabel: string;
      evidence: string;
      sessionsWithEvidence: number;
    }> = [];

    if (analysis.conceptEvaluations && Array.isArray(analysis.conceptEvaluations)) {
      for (const ce of analysis.conceptEvaluations) {
        if (!ce.conceptId) continue;

        const correctUnprompted = Number(ce.correctUnprompted) || 0;
        const correctPrompted = Number(ce.correctPrompted) || 0;
        const incorrect = Number(ce.incorrect) || 0;

        // Calculate delta for this session
        const delta = (correctUnprompted * 0.15) + (correctPrompted * 0.05) + (incorrect * -0.10);
        const hasEvidence = (correctUnprompted + correctPrompted + incorrect) > 0;

        const conceptType = ce.conceptId.startsWith("grammar.")
          ? ConceptType.GRAMMAR
          : ce.conceptId.startsWith("vocab.")
            ? ConceptType.VOCABULARY
            : ce.conceptId.startsWith("pronunciation.")
              ? ConceptType.PRONUNCIATION
              : ce.conceptId.startsWith("culture.")
                ? ConceptType.CULTURE
                : ConceptType.PRAGMATICS;

        // Get existing mastery
        const existing = await prisma.conceptMastery.findUnique({
          where: {
            userId_conceptId: {
              userId: session.user.id,
              conceptId: ce.conceptId,
            },
          },
        });

        const previousScore = existing?.masteryScore ?? 0;
        const previousSessions = existing?.sessionsWithEvidence ?? 0;
        const newSessionsWithEvidence = previousSessions + (hasEvidence ? 1 : 0);

        // Apply delta, clamped to [0, 1]
        let newScore = Math.min(1, Math.max(0, previousScore + delta));

        // Enforce 3-session minimum: cap at 0.74 until 3+ sessions with evidence
        if (newScore >= 0.75 && newSessionsWithEvidence < 3) {
          newScore = 0.74;
        }

        if (existing) {
          await prisma.conceptMastery.update({
            where: {
              userId_conceptId: {
                userId: session.user.id,
                conceptId: ce.conceptId,
              },
            },
            data: {
              masteryScore: newScore,
              practiceCount: { increment: 1 },
              sessionsWithEvidence: newSessionsWithEvidence,
              lastPracticed: new Date(),
            },
          });
        } else {
          await prisma.conceptMastery.create({
            data: {
              userId: session.user.id,
              conceptId: ce.conceptId,
              conceptType,
              masteryScore: Math.min(newScore, 0.74), // First session can never reach mastery
              practiceCount: 1,
              sessionsWithEvidence: hasEvidence ? 1 : 0,
              lastPracticed: new Date(),
            },
          });
        }

        conceptResults.push({
          conceptId: ce.conceptId,
          previousScore,
          newScore: existing ? newScore : Math.min(newScore, 0.74),
          delta,
          progressLabel: ce.progressLabel || "making_progress",
          evidence: ce.evidence || "",
          sessionsWithEvidence: newSessionsWithEvidence,
        });
      }
    }

    // Calculate session duration
    const sessionDurationMinutes = convSession.endedAt
      ? Math.round((new Date(convSession.endedAt).getTime() - new Date(convSession.startedAt).getTime()) / 60000)
      : Math.round((Date.now() - new Date(convSession.startedAt).getTime()) / 60000);

    const exchangeCount = convSession.messages.filter(m => m.role === MessageRole.USER && m.content !== "[START_SESSION]").length;

    // ── Award XP ──
    let xpAwarded = 0;
    let leveledUp = false;
    let newLevel = 0;
    try {
      // Count concept improvements (positive delta)
      const conceptImprovements = conceptResults.filter((c) => c.delta > 0).length;

      // Calculate session XP
      const sessionXp = calculateSessionXp(
        convSession.sessionType as any,
        exchangeCount,
        conceptImprovements,
      );

      if (sessionXp > 0) {
        const xpResult = await awardXp(
          session.user.id,
          sessionXp,
          `session_${convSession.sessionType.toLowerCase()}`,
          `${convSession.sessionType} session: ${exchangeCount} exchanges, ${conceptImprovements} concept improvements`,
        );
        xpAwarded = sessionXp;
        leveledUp = xpResult.leveledUp;
        newLevel = xpResult.xpLevel;

        // Award coins for session completion
        const coinReward = 15 + (xpResult.leveledUp ? 100 : 0);
        await awardCoins(session.user.id, coinReward);
      }
    } catch (xpError) {
      console.error("XP award error (non-fatal):", xpError);
    }

    return res.json({
      summary: {
        topicsCovered: analysis.topicsCovered,
        vocabularyIntroduced: analysis.vocabularyIntroduced,
        grammarPracticed: analysis.grammarPracticed,
        errorsObserved: analysis.errorsObserved,
        overallNotes: analysis.overallNotes,
      },
      conceptResults,
      sessionHighlights: analysis.sessionHighlights || {
        didWell: [],
        focusNextTime: [],
        tutorClosingNote: "",
      },
      sessionMeta: {
        sessionType: convSession.sessionType,
        durationMinutes: sessionDurationMinutes,
        exchangeCount,
      },
      suggestedFocus: analysis.suggestedFocus || [],
      xpAwarded,
      leveledUp,
      newLevel,
    });
  } catch (error: any) {
    console.error("Session analysis error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
