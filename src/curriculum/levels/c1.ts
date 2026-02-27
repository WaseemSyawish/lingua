import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "../types";

export const c1Curriculum: LevelCurriculum = {
  level: CEFRLevel.C1,
  label: "Advanced",
  description: "Can understand a wide range of demanding, longer texts, and recognize implicit meaning. Can express ideas fluently and spontaneously.",
  languageBalance: "Entirely French at all times. The tutor behaves as an educated native speaker. No English under any circumstances.",
  vocabularyClusters: [
    {
      name: "Precise emotional vocabulary",
      conceptId: "vocab.precise_emotions",
      words: ["atterré", "ébahi", "navré", "émerveillé", "consterné", "désemparé", "exalté", "accablé", "résigné"],
    },
    {
      name: "Academic discourse",
      conceptId: "vocab.academic_discourse",
      words: ["hypothèse", "méthodologie", "paradigme", "corpus", "en somme", "à cet égard", "il s'avère que", "en ce qui concerne", "sous-jacent"],
    },
    {
      name: "Stylistic devices",
      conceptId: "vocab.stylistic_devices",
      words: ["litote", "euphémisme", "ironie", "métaphore", "antithèse", "hyperbole", "périphrase"],
    },
    {
      name: "Familiar/regional language",
      conceptId: "vocab.familiar_regional",
      words: ["verlan", "meuf", "keuf", "kiffer", "ouf", "relou", "chanmé", "galère"],
    },
    {
      name: "Philosophical vocabulary",
      conceptId: "vocab.philosophical",
      words: ["éthique", "morale", "déterminisme", "existentialisme", "phénoménologie", "altérité", "dialectique"],
    },
  ],
  grammarConcepts: [
    {
      conceptId: "grammar.subjonctif_all_tenses",
      name: "Subjunctive — all tenses",
      description: "Including imparfait du subjonctif (at least recognition)",
      examples: ["Il eût fallu qu'il vînt.", "Je souhaitais qu'il fît attention."],
    },
    {
      conceptId: "grammar.nominalisation_mastery",
      name: "Nominalisation mastery",
      description: "Fluid conversion between verbal and nominal forms",
      examples: ["La restructuration de l'entreprise...", "L'augmentation des prix entraîne..."],
    },
    {
      conceptId: "grammar.discourse_structuring",
      name: "Advanced discourse structuring",
      description: "Organizing complex arguments with sophisticated connectors",
      examples: ["D'une part... d'autre part...", "Non seulement... mais encore...", "En premier lieu... en second lieu..."],
    },
    {
      conceptId: "grammar.stylistic_inversion",
      name: "Stylistic inversion",
      description: "Inverted subject-verb for emphasis or literary style",
      examples: ["À peine était-il arrivé que...", "Peut-être devriez-vous...", "Sans doute est-ce la raison."],
    },
    {
      conceptId: "grammar.literary_tenses",
      name: "Literary tenses",
      description: "Passé simple and imparfait du subjonctif recognition and limited production",
      examples: ["Il fut surpris.", "Ils allèrent au marché.", "Elle chanta toute la nuit."],
    },
    {
      conceptId: "grammar.implicit_meaning",
      name: "Implicit meaning construction",
      description: "Saying things indirectly — understatement, suggestion, implication",
      examples: ["Ce n'est pas que je n'aime pas, mais...", "Il semblerait que...", "On pourrait éventuellement..."],
    },
    {
      conceptId: "grammar.advanced_concession",
      name: "Advanced concession structures",
      description: "Complex concessive constructions",
      examples: ["Quand bien même il viendrait...", "Pour autant que je sache...", "Tout intelligent qu'il soit..."],
    },
  ],
  listeningTasks: [
    "Understand implicit meaning and cultural subtext",
    "Detect humor, irony, and register nuance",
    "Follow rapid, colloquial French",
  ],
  readingTasks: [
    "Literary texts from major French authors",
    "Academic articles and research papers",
    "Legal and administrative documents",
    "Philosophical texts",
  ],
  speakingTasks: [
    "Fluent debate on abstract topics",
    "Impromptu presentations",
    "Nuanced negotiation",
    "Storytelling with stylistic variation",
  ],
  writingTasks: [
    "Academic essay with proper structure",
    "Creative writing with style",
    "Formal reports",
    "Stylistically varied writing across registers",
  ],
  masteryEvidence: [
    "Near-native accuracy in all core grammar",
    "Can handle any topic without preparation",
    "Demonstrates stylistic range across registers",
    "Error rate <5% in core grammar",
    "Shows awareness of cultural and pragmatic nuance",
    "Can detect and use irony, understatement, and implicit meaning",
  ],
  conceptIds: [
    "grammar.subjonctif_all_tenses",
    "grammar.nominalisation_mastery",
    "grammar.discourse_structuring",
    "grammar.stylistic_inversion",
    "grammar.literary_tenses",
    "grammar.implicit_meaning",
    "grammar.advanced_concession",
    "vocab.precise_emotions",
    "vocab.academic_discourse",
    "vocab.stylistic_devices",
    "vocab.familiar_regional",
    "vocab.philosophical",
  ],
};
