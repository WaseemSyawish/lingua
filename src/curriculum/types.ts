import { CEFRLevel } from "@/generated/prisma/enums";

export interface VocabularyCluster {
  name: string;
  words: string[];
  conceptId: string;
}

export interface GrammarConcept {
  conceptId: string;
  name: string;
  description: string;
  examples: string[];
}

export interface LevelCurriculum {
  level: CEFRLevel;
  label: string;
  description: string;
  languageBalance: string;
  vocabularyClusters: VocabularyCluster[];
  grammarConcepts: GrammarConcept[];
  listeningTasks: string[];
  readingTasks: string[];
  speakingTasks: string[];
  writingTasks: string[];
  masteryEvidence: string[];
  conceptIds: string[];
}
