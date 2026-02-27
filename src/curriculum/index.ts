import { CEFRLevel } from "@/generated/prisma/enums";
import { LevelCurriculum } from "./types";
import { a0Curriculum } from "./levels/a0";
import { a1Curriculum } from "./levels/a1";
import { a2Curriculum } from "./levels/a2";
import { b1Curriculum } from "./levels/b1";
import { b2Curriculum } from "./levels/b2";
import { c1Curriculum } from "./levels/c1";
import { c2Curriculum } from "./levels/c2";

const curriculumMap: Record<CEFRLevel, LevelCurriculum> = {
  [CEFRLevel.A0]: a0Curriculum,
  [CEFRLevel.A1]: a1Curriculum,
  [CEFRLevel.A2]: a2Curriculum,
  [CEFRLevel.B1]: b1Curriculum,
  [CEFRLevel.B2]: b2Curriculum,
  [CEFRLevel.C1]: c1Curriculum,
  [CEFRLevel.C2]: c2Curriculum,
};

export function getCurriculumForLevel(level: CEFRLevel): LevelCurriculum {
  return curriculumMap[level];
}

export function getAllConceptIds(level: CEFRLevel): string[] {
  return curriculumMap[level].conceptIds;
}

export function getConceptType(conceptId: string): string {
  if (conceptId.startsWith("grammar.")) return "GRAMMAR";
  if (conceptId.startsWith("vocab.")) return "VOCABULARY";
  if (conceptId.startsWith("pronunciation.")) return "PRONUNCIATION";
  if (conceptId.startsWith("culture.")) return "CULTURE";
  return "PRAGMATICS";
}

export { type LevelCurriculum } from "./types";
