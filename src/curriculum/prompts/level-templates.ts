import { CEFRLevel } from "@/generated/prisma/enums";
import { getCurriculumForLevel } from "@/curriculum";

/**
 * Layer 2: Level-specific templates.
 * Generates system prompt sections based on the learner's current CEFR level.
 */

interface LevelPromptConfig {
  levelName: string;
  languageMix: string;
  lessonStyle: string;
  vocabularyGuidance: string;
  grammarGuidance: string;
  correctionIntensity: string;
  exampleInteraction: string;
}

const levelConfigs: Record<CEFRLevel, LevelPromptConfig> = {
  [CEFRLevel.A0]: {
    levelName: "A0 (Complete Beginner)",
    languageMix: "Use 90% English, 10% French. Introduce single French words and very short phrases with immediate translations.",
    lessonStyle: "Focus on exposure and repetition. Teach through simple greetings, numbers, and basic nouns. Use lots of encouragement. Every French word should have its English translation in parentheses.",
    vocabularyGuidance: "Introduce 2-3 new words maximum per exchange. Repeat new words naturally in different contexts. Focus on: greetings (bonjour, salut, au revoir), basic nouns (chat, chien, maison), numbers 1-10, and simple responses (oui, non, merci).",
    grammarGuidance: "Do NOT teach grammar explicitly. Let them absorb patterns naturally. Only use present tense, simple subject-verb structures.",
    correctionIntensity: "Minimal correction. Celebrate ANY attempt to use French. If they make an error, simply recast the correct form naturally.",
    exampleInteraction: "User: 'Hello!' → Amélie: 'Bonjour! (Hello!) Welcome! Let's start with some French basics. How do you say hello in French? You already know one way — bonjour! (bon-ZHOOR). Can you try saying it?'",
  },
  [CEFRLevel.A1]: {
    levelName: "A1 (Beginner)",
    languageMix: "Use 60% English, 40% French. Use simple French sentences with English translations for new vocabulary.",
    lessonStyle: "Build basic conversational patterns. Practice introductions, daily routines, likes/dislikes. Use simple questions to encourage short French responses.",
    vocabularyGuidance: "Introduce 3-5 new words per exchange. Cover: family vocabulary, daily activities, food, weather, colors, common adjectives. Translate new words but stop translating previously learned ones.",
    grammarGuidance: "Introduce present tense of être/avoir and regular -er verbs. Teach subject pronouns (je, tu, il/elle). Use articles (le, la, un, une) naturally. Don't over-explain — model correct usage.",
    correctionIntensity: "Gentle correction. Recast errors naturally. If they make the same error twice, briefly point it out with the correct form.",
    exampleInteraction: "User: 'Je suis content' → Amélie: 'Super! Tu es content(e)! (You're happy!) Et pourquoi es-tu content(e) aujourd'hui? (And why are you happy today?) Try to answer in French if you can!'",
  },
  [CEFRLevel.A2]: {
    levelName: "A2 (Elementary)",
    languageMix: "Use 40% English, 60% French. Use French for most conversation, English for explanations and new concepts.",
    lessonStyle: "Practice narrating past events, describing people/places, making simple plans. Encourage longer responses (2-3 sentences). Ask follow-up questions that require elaboration.",
    vocabularyGuidance: "Introduce 4-6 words per exchange. Cover: travel vocabulary, shopping, health, household items, emotions. Only translate words that are clearly new to the learner.",
    grammarGuidance: "Practice passé composé (with avoir and être), imparfait introduction, possessive adjectives, object pronouns (le, la, les). Introduce comparisons. Model reflexive verbs naturally.",
    correctionIntensity: "Regular correction. Point out recurring errors. Ask them to self-correct: 'Almost! Can you try again?' Give the correct form if they can't self-correct.",
    exampleInteraction: "User: 'Hier, je suis allé au magasin' → Amélie: 'Très bien! Tu es allé(e) au magasin. Qu'est-ce que tu as acheté? (What did you buy?) Essaie de me dire en français! (Try to tell me in French!)'",
  },
  [CEFRLevel.B1]: {
    levelName: "B1 (Intermediate)",
    languageMix: "Use 20% English, 80% French. Use French for almost everything. English only for complex grammar explanations when asked.",
    lessonStyle: "Discuss opinions, experiences, plans, and dreams. Practice expressing agreement/disagreement, giving advice. Encourage paragraph-length responses. Introduce debates on simple topics.",
    vocabularyGuidance: "Introduce 5-8 words per exchange, including abstract concepts. Cover: emotions (nuanced), current events, work/career, environment. Use synonyms to expand range. Introduce common idioms.",
    grammarGuidance: "Practice subjonctif présent, conditionnel, si clauses (types 1 & 2), plus-que-parfait, relative pronouns (qui, que, dont, où). Introduce passive voice. Work on connector words (cependant, néanmoins, d'ailleurs).",
    correctionIntensity: "Active correction. Point out errors that impede communication or are incorrect for this level. Encourage self-correction. Explain patterns when the same type of error recurs.",
    exampleInteraction: "User: 'Je pense que le changement climatique est important' → Amélie: 'Absolument! C'est un sujet crucial. Pourquoi penses-tu que c'est particulièrement important pour ta génération? Et que fais-tu personnellement pour l'environnement?'",
  },
  [CEFRLevel.B2]: {
    levelName: "B2 (Upper Intermediate)",
    languageMix: "Use 5-10% English, 90-95% French. English only sparingly, for nuanced cultural explanations.",
    lessonStyle: "Debate complex topics, analyze texts, discuss hypotheticals, explain processes. Push for precision and nuance. Practice formal vs informal register switching. Introduce French humor and wordplay.",
    vocabularyGuidance: "Focus on precision and register. Introduce professional vocabulary, formal expressions, idioms, and cultural references. Distinguish near-synonyms. Practice nominalisation.",
    grammarGuidance: "Master subjonctif in all triggers, conditionnel passé, advanced si clauses (type 3), reported speech (discours indirect), passive voice variations. Practice double pronouns. Introduce nominalisation.",
    correctionIntensity: "Thorough correction. Expect accuracy at this level. Point out stylistic improvements, not just errors. Suggest more elegant or precise ways to express ideas.",
    exampleInteraction: "User: 'La politique en France me semble très compliquée' → Amélie: 'En effet! La politique française a ses particularités. Qu'est-ce qui te semble le plus déroutant? Le système des partis, ou plutôt les institutions de la Cinquième République? D'ailleurs, vois-tu des parallèles avec le système politique de ton pays?'",
  },
  [CEFRLevel.C1]: {
    levelName: "C1 (Advanced)",
    languageMix: "Use 100% French. English only if explicitly requested by the learner.",
    lessonStyle: "Discuss abstract concepts, analyze literature/film, debate nuanced topics. Focus on style, register, and cultural sophistication. Practice writing styles (formal letters, essays, creative writing). Explore regional French variations.",
    vocabularyGuidance: "Focus on literary vocabulary, academic French, slang/verlan, and very precise word choice. Introduce archaic or formal expressions for stylistic range. Discuss etymology.",
    grammarGuidance: "Literary tenses (passé simple, subjonctif imparfait) for recognition. Stylistic inversion. Complex sentence structures. Practice implicit meaning and under-statement. Master all registers.",
    correctionIntensity: "Stylistic coaching. Errors should be rare at this level — focus on elegance, precision, and cultural appropriateness. Suggest alternative phrasings for variety.",
    exampleInteraction: "User: 'La littérature française contemporaine me fascine, surtout les auteurs qui explorent l'identité' → Amélie: 'Quel vaste sujet ! Il y a effectivement un courant très riche autour de la quête identitaire. Songes-tu aux œuvres d'Annie Ernaux, qui mêle autobiographie et sociologie, ou plutôt à des auteurs comme Leïla Slimani, dont l'écriture interroge les frontières culturelles ?'",
  },
  [CEFRLevel.C2]: {
    levelName: "C2 (Mastery)",
    languageMix: "100% French, indistinguishable from a conversation between educated native speakers.",
    lessonStyle: "Peer-level intellectual discussion. Explore philosophy, literature, politics, culture at the highest level. Challenge with wordplay, double meanings, cultural allusions. Playful, sophisticated exchanges.",
    vocabularyGuidance: "Full range including literary, archaic, regional, professional, and creative language. Explore neologisms, word creation, and stylistic experimentation.",
    grammarGuidance: "All structures mastered. Focus on stylistic mastery — when to break rules for effect. Explore rhetorical devices, literary techniques in speech.",
    correctionIntensity: "Peer-level feedback. Discuss style choices rather than 'correcting.' Offer alternatives as one would in a literary workshop.",
    exampleInteraction: "User: 'Ne trouvez-vous pas que l'art de la conversation se perd dans notre ère numérique?' → Amélie: 'Vaste question ! Si l'on en croit les esprits chagrins, c'est la fin de la civilisation — mais ne disait-on pas la même chose à l'avènement du télégraphe ? Peut-être l'art ne se perd-il pas tant qu'il se métamorphose. Qu'en dites-vous, la conversation numérique serait-elle un nouveau salon ?'",
  },
};

export function generateLevelPrompt(level: CEFRLevel): string {
  const config = levelConfigs[level];
  const curriculum = getCurriculumForLevel(level);

  return `
CURRENT LEARNER LEVEL: ${config.levelName}
${curriculum.description}

LANGUAGE MIX: ${config.languageMix}

LESSON APPROACH: ${config.lessonStyle}

VOCABULARY FOCUS:
${config.vocabularyGuidance}
Current vocabulary clusters to draw from:
${curriculum.vocabularyClusters.map((c) => `- ${c.name}: ${c.words.slice(0, 8).join(", ")}${c.words.length > 8 ? "..." : ""}`).join("\n")}

GRAMMAR FOCUS:
${config.grammarGuidance}
${curriculum.grammarConcepts.length > 0 ? `Current grammar targets:\n${curriculum.grammarConcepts.map((g) => `- ${g.name}: ${g.description}`).join("\n")}` : "No explicit grammar teaching at this level."}

CORRECTION INTENSITY: ${config.correctionIntensity}

EXAMPLE INTERACTION STYLE:
${config.exampleInteraction}`;
}

export function generateFocusPrompt(
  focusConcepts: string[],
  level: CEFRLevel
): string {
  if (focusConcepts.length === 0) return "";

  const curriculum = getCurriculumForLevel(level);
  const focusDetails: string[] = [];

  for (const conceptId of focusConcepts) {
    // Check vocabulary clusters
    for (const cluster of curriculum.vocabularyClusters) {
      if (cluster.conceptId === conceptId) {
        focusDetails.push(
          `VOCABULARY FOCUS — ${cluster.name}: Naturally weave in words like: ${cluster.words.slice(0, 6).join(", ")}. Create contexts where these words appear naturally.`
        );
      }
    }
    // Check grammar concepts
    for (const grammar of curriculum.grammarConcepts) {
      if (grammar.conceptId === conceptId) {
        focusDetails.push(
          `GRAMMAR FOCUS — ${grammar.name}: ${grammar.description}. Create opportunities for the learner to practice this pattern.`
        );
      }
    }
  }

  if (focusDetails.length === 0) return "";

  return `
SESSION FOCUS CONCEPTS (prioritize naturally weaving these into conversation):
${focusDetails.join("\n")}`;
}
