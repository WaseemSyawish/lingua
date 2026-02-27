import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "../types";

export const c2Curriculum: LevelCurriculum = {
  level: CEFRLevel.C2,
  label: "Mastery",
  description: "Can understand virtually everything heard or read. Can summarize information from different sources, reconstructing arguments in a coherent presentation.",
  languageBalance: "Entirely French. The tutor behaves as a native conversation partner across any domain. Enrichment and maintenance mode.",
  vocabularyClusters: [
    {
      name: "Literary & archaic",
      conceptId: "vocab.literary_archaic",
      words: ["nonobstant", "sus", "naguère", "dorénavant", "outrecuidance", "forfaire", "magnanime"],
    },
    {
      name: "Domain-specific precision",
      conceptId: "vocab.domain_specific",
      words: ["jurisprudence", "épistémologie", "herméneutique", "ontologie", "sémiologie", "praxis"],
    },
    {
      name: "Creative expression",
      conceptId: "vocab.creative_expression",
      words: ["synesthésie", "prosopopée", "oxymore", "chiasme", "anaphore", "zeugme"],
    },
  ],
  grammarConcepts: [
    {
      conceptId: "grammar.c2_stylistic_mastery",
      name: "Complete stylistic mastery",
      description: "All grammatical structures used with native-level precision and style",
      examples: ["Eût-il su, il n'en eût rien fait.", "Fût-ce la dernière fois..."],
    },
    {
      conceptId: "grammar.c2_register_full",
      name: "Full register mastery",
      description: "Effortless switching between argot, standard, soutenu, and littéraire",
      examples: ["Argot: Il s'est barré.", "Standard: Il est parti.", "Soutenu: Il a pris congé.", "Littéraire: Il s'en fut."],
    },
  ],
  listeningTasks: [
    "Understand any spoken French regardless of speed, accent, or register",
    "Follow complex academic lectures",
    "Understand regional dialects and historical French",
  ],
  readingTasks: [
    "Any text in French including specialized academic, legal, literary",
    "Classical French literature",
    "Dense philosophical texts",
  ],
  speakingTasks: [
    "Native-level conversation on any topic",
    "Formal presentations with Q&A",
    "Creative storytelling and wordplay",
    "Simultaneous interpretation-level fluency",
  ],
  writingTasks: [
    "Academic publications-quality writing",
    "Literary creative writing",
    "Professional documents at native level",
    "Stylistic pastiche of different authors",
  ],
  masteryEvidence: [
    "C2 is the ceiling — tutor shifts to maintenance and enrichment",
    "Near-zero systematic errors",
    "Native-level fluency across all domains",
    "Full cultural and pragmatic competence",
  ],
  conceptIds: [
    "grammar.c2_stylistic_mastery",
    "grammar.c2_register_full",
    "vocab.literary_archaic",
    "vocab.domain_specific",
    "vocab.creative_expression",
  ],
};
