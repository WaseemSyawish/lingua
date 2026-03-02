import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "./types";
import { frCurriculum } from "./languages/fr";
import { esCurriculum } from "./languages/es";
import { deCurriculum } from "./languages/de";

/* ─── Language-aware curriculum registry ─── */

type SupportedLanguage = "fr" | "es" | "de";

const curriculumByLanguage: Record<SupportedLanguage, Record<CEFRLevel, LevelCurriculum>> = {
  fr: frCurriculum,
  es: esCurriculum,
  de: deCurriculum,
};

/**
 * Get the curriculum for a given CEFR level and target language.
 * Falls back to French if the language is not found.
 */
export function getCurriculumForLevel(
  level: CEFRLevel,
  language: string = "fr"
): LevelCurriculum {
  const lang = (language as SupportedLanguage) in curriculumByLanguage
    ? (language as SupportedLanguage)
    : "fr";
  return curriculumByLanguage[lang][level];
}

export function getAllConceptIds(level: CEFRLevel, language: string = "fr"): string[] {
  return getCurriculumForLevel(level, language).conceptIds;
}

export function getConceptType(conceptId: string): string {
  if (conceptId.startsWith("grammar.")) return "GRAMMAR";
  if (conceptId.startsWith("vocab.")) return "VOCABULARY";
  if (conceptId.startsWith("pronunciation.")) return "PRONUNCIATION";
  if (conceptId.startsWith("culture.")) return "CULTURE";
  return "PRAGMATICS";
}

/**
 * Resolve a raw concept ID (e.g. "grammar.passe_compose_avoir") to its
 * human-readable name (e.g. "Passé composé avec avoir").
 *
 * Scans every CEFR level for the given language. Falls back to a prettified
 * version of the ID if no curriculum match is found.
 */
export function getConceptName(conceptId: string, language: string = "fr"): string {
  const lang = (language as SupportedLanguage) in curriculumByLanguage
    ? (language as SupportedLanguage)
    : "fr";
  const levels = curriculumByLanguage[lang];

  for (const level of Object.values(levels)) {
    // Check grammar concepts
    for (const g of level.grammarConcepts) {
      if (g.conceptId === conceptId) return g.name;
    }
    // Check vocabulary clusters
    for (const v of level.vocabularyClusters) {
      if (v.conceptId === conceptId) return v.name;
    }
  }

  // Fallback: strip prefix & prettify
  const stripped = conceptId
    .replace(/^(grammar|vocab|pronunciation|culture|pragmatics)\./, "")
    .replace(/_/g, " ");
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}

export { type LevelCurriculum } from "./types";
