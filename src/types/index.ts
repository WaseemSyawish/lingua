import { CEFRLevel, SessionType } from "@/generated/prisma/enums";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface SessionInfo {
  id: string;
  sessionNumber: number;
  sessionType: SessionType;
  messageCount: number;
  startedAt: string;
  endedAt: string | null;
}

export interface UserProgress {
  currentLevel: CEFRLevel;
  skillProfile: {
    comprehensionScore: number;
    vocabularyScore: number;
    grammarScore: number;
    fluencyScore: number;
    overallConfidence: number;
  } | null;
  totalSessions: number;
  conceptMasteries: ConceptMasteryInfo[];
  recentSessions: SessionInfo[];
}

export interface ConceptMasteryInfo {
  conceptId: string;
  conceptType: string;
  masteryScore: number;
  practiceCount: number;
  lastPracticed: string | null;
}

export interface SessionAnalysis {
  topicsCovered: string;
  vocabularyIntroduced: string;
  grammarPracticed: string;
  errorsObserved: string;
  overallNotes: string;
  conceptScores: Array<{
    conceptId: string;
    score: number;
    notes: string;
  }>;
  suggestedFocus: string[];
}

export interface PlacementResult {
  level: CEFRLevel;
  analysis: {
    confidence: number;
    comprehension: number;
    vocabulary: number;
    grammar: number;
    fluency: number;
    culturalAwareness: number;
    reasoning: string;
    strengths: string[];
    areasToImprove: string[];
  };
}

export interface StreamEvent {
  type: "delta" | "done" | "error";
  text?: string;
  error?: string;
  messageId?: string;
}
