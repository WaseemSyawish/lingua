import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "../types";

export const a0Curriculum: LevelCurriculum = {
  level: CEFRLevel.A0,
  label: "Pre-beginner",
  description: "Zero French exposure. Building comfort and first contact with the language.",
  languageBalance: "Entirely English. French only as isolated words woven naturally into English conversation with immediate translation. Never ask the learner to form French sentences.",
  vocabularyClusters: [
    {
      name: "Greetings",
      conceptId: "vocab.greetings_basic",
      words: ["bonjour", "bonsoir", "salut", "au revoir", "merci", "s'il vous plaît", "de rien"],
    },
    {
      name: "Daily nouns",
      conceptId: "vocab.daily_nouns_basic",
      words: ["café", "eau", "pain", "matin", "soir", "maison", "école"],
    },
    {
      name: "Responses",
      conceptId: "vocab.responses_basic",
      words: ["oui", "non", "ça va", "très bien", "d'accord"],
    },
    {
      name: "Numbers",
      conceptId: "vocab.numbers_1_10",
      words: ["un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
    },
    {
      name: "Identity",
      conceptId: "vocab.identity_basic",
      words: ["je", "nom", "comment"],
    },
  ],
  grammarConcepts: [],
  listeningTasks: [
    "Hear individual French words in English sentences",
    "Recognize French phonemes in safe context",
  ],
  readingTasks: [],
  speakingTasks: [
    "May repeat individual words voluntarily — never required",
  ],
  writingTasks: [],
  masteryEvidence: [
    "Recognizes and can produce 20+ basic French words",
    "Shows comfort hearing French",
    "Voluntarily tries to use French words",
    "Shows no anxiety or resistance toward the language",
    "At least 3 sessions completed",
  ],
  conceptIds: [
    "vocab.greetings_basic",
    "vocab.daily_nouns_basic",
    "vocab.responses_basic",
    "vocab.numbers_1_10",
  ],
};
