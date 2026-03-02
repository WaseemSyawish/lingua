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
  focusConcepts?: string[];
  summary?: {
    topicsCovered: string;
    overallNotes: string;
  } | null;
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

export interface SessionSummaryData {
  summary: {
    topicsCovered: string;
    vocabularyIntroduced: string;
    grammarPracticed: string;
    errorsObserved: string;
    overallNotes: string;
  };
  conceptResults: Array<{
    conceptId: string;
    previousScore: number;
    newScore: number;
    delta: number;
    progressLabel: "struggling" | "making_progress" | "getting_comfortable" | "strong";
    evidence: string;
    sessionsWithEvidence: number;
  }>;
  sessionHighlights: {
    didWell: string[];
    focusNextTime: string[];
    tutorClosingNote: string;
  };
  sessionMeta: {
    sessionType: string;
    durationMinutes: number;
    exchangeCount: number;
  };
  suggestedFocus: string[];
  xpAwarded?: number;
  leveledUp?: boolean;
  newLevel?: number;
  freePerks?: Array<{ id: string; name: string; description: string; icon: string }>;
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
  type: "delta" | "done" | "error" | "session_complete";
  text?: string;
  error?: string;
  messageId?: string;
  sessionId?: string;
}
