import { CEFRLevel, SessionType } from "@/generated/prisma/enums";
import { BASE_PERSONA, PLACEMENT_PERSONA_ADDITION } from "@/curriculum/prompts/base-persona";
import { generateLevelPrompt, generateFocusPrompt } from "@/curriculum/prompts/level-templates";

interface PromptBuilderOptions {
  level: CEFRLevel;
  sessionType: SessionType;
  focusConcepts?: string[];
  conversationSummaries?: string[];
  userName?: string;
}

/**
 * Composes the 3-layer system prompt:
 * Layer 1: Base persona (constant)
 * Layer 2: Level-specific curriculum context
 * Layer 3: Session-specific context (memory, focus concepts)
 */
export function buildSystemPrompt(options: PromptBuilderOptions): string {
  const {
    level,
    sessionType,
    focusConcepts = [],
    conversationSummaries = [],
    userName,
  } = options;

  const parts: string[] = [];

  // Layer 1: Base persona
  parts.push(BASE_PERSONA);

  // Add placement-specific instructions if this is a placement session
  if (sessionType === SessionType.PLACEMENT) {
    parts.push(PLACEMENT_PERSONA_ADDITION);
    if (userName) {
      parts.push(`\nThe learner's name is ${userName}. Use it naturally in conversation.`);
    }
    return parts.join("\n\n");
  }

  // Layer 2: Level-specific context
  parts.push(generateLevelPrompt(level));

  // Session type specific context
  switch (sessionType) {
    case SessionType.LESSON:
      parts.push(`
SESSION TYPE: Structured Lesson
Guide the conversation towards the focus concepts. Create natural contexts for practice. 
Balance between teaching new material and reinforcing what was covered.
End the session by briefly reviewing what was practiced (when the learner says goodbye or after ~15 exchanges).`);
      break;
    case SessionType.FREE_CONVERSATION:
      parts.push(`
SESSION TYPE: Free Conversation
Let the learner guide the topic. Your role is to keep the conversation flowing naturally.
Still apply correction and vocabulary expansion, but prioritize fluency and confidence over accuracy.
Don't force specific topics — follow the learner's interests.`);
      break;
    case SessionType.REVIEW:
      parts.push(`
SESSION TYPE: Review Session
Focus on reinforcing concepts the learner has previously struggled with.
Revisit vocabulary and grammar from previous sessions.
Create varied contexts for the same structures to deepen understanding.`);
      break;
  }

  // Focus concepts
  if (focusConcepts.length > 0) {
    parts.push(generateFocusPrompt(focusConcepts, level));
  }

  // Layer 3: Conversation memory
  if (conversationSummaries.length > 0) {
    const memorySection = conversationSummaries
      .slice(-3) // Last 3 sessions for context
      .join("\n---\n");
    parts.push(`
PREVIOUS SESSION CONTEXT (use this to maintain continuity):
${memorySection}
Reference previous topics or vocabulary when natural. The learner should feel like you remember them.`);
  }

  // Learner name
  if (userName) {
    parts.push(`\nThe learner's name is ${userName}. Use it occasionally and naturally.`);
  }

  return parts.join("\n\n");
}

/**
 * Estimate token count for a string (rough approximation: ~4 chars per token for mixed EN/FR)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
