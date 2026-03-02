/**
 * XP system constants and pure utility functions.
 * Safe for client-side import (no Prisma dependency).
 *
 * XP Level Thresholds:
 * L1-10:  500 XP each  (0 → 5,000)
 * L11-25: 1,000 XP each (5,000 → 20,000)
 * L26+:   2,000 XP each (20,000+)
 */

export function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 10) return (level - 1) * 500;
  if (level <= 25) return 4500 + (level - 10) * 1000;
  return 19500 + (level - 25) * 2000;
}

export function xpToNextLevel(level: number): number {
  if (level <= 10) return 500;
  if (level <= 25) return 1000;
  return 2000;
}

export function calculateLevel(totalXp: number): number {
  let level = 1;
  while (xpForLevel(level + 1) <= totalXp) {
    level++;
  }
  return level;
}

export function xpProgressInLevel(totalXp: number, level: number): { current: number; needed: number; percent: number } {
  const levelStart = xpForLevel(level);
  const needed = xpToNextLevel(level);
  const current = totalXp - levelStart;
  return {
    current,
    needed,
    percent: Math.min(100, Math.round((current / needed) * 100)),
  };
}

/** XP sources with their base amounts */
export const XP_SOURCES = {
  SESSION_LESSON: { min: 50, max: 75, label: "Lesson completed" },
  SESSION_FREE_CONVERSATION: { min: 45, max: 70, label: "Free conversation" },
  SESSION_REVIEW: { min: 40, max: 60, label: "Review session" },
  SESSION_READING: { min: 45, max: 65, label: "Reading session" },
  SESSION_WRITING: { min: 50, max: 70, label: "Writing session" },
  CONCEPT_IMPROVEMENT: { amount: 10, label: "Concept improved" },
  ACHIEVEMENT_NEW: { amount: 100, label: "Achievement earned" },
  ACHIEVEMENT_UPGRADE: { amount: 50, label: "Achievement tier upgrade" },
  DAILY_STREAK: { amount: 25, label: "Daily streak bonus" },
  CULTURAL_ACHIEVEMENT: { amount: 150, label: "Cultural achievement" },
} as const;

/** Level perks */
export const LEVEL_PERKS: { level: number; label: string; icon: string; desc: string }[] = [
  { level: 3, label: "Streak Freeze", icon: "❄️", desc: "Protect your streak once (coming soon)" },
  { level: 5, label: "Custom Greeting", icon: "👋", desc: "Tutor uses your preferred greeting" },
  { level: 8, label: "Bonus Review", icon: "📚", desc: "Extra review session insights" },
  { level: 10, label: "Profile Badge", icon: "🏅", desc: "Exclusive Level 10 profile badge" },
  { level: 15, label: "Early Access", icon: "🚀", desc: "Try new features first" },
  { level: 20, label: "Custom Bubbles", icon: "🎨", desc: "Custom chat bubble colors" },
];

/**
 * Calculate session completion XP based on session type and quality.
 */
export function calculateSessionXp(
  sessionType: string,
  exchangeCount: number,
  conceptImprovements: number
): number {
  const sourceKey = `SESSION_${sessionType}` as keyof typeof XP_SOURCES;
  const source = XP_SOURCES[sourceKey];

  if (!source || !("min" in source)) return 50;

  const range = source.max - source.min;
  const exchangeFactor = Math.min(1, exchangeCount / 12);
  const base = Math.round(source.min + range * exchangeFactor);

  const conceptBonus = conceptImprovements * XP_SOURCES.CONCEPT_IMPROVEMENT.amount;

  return base + conceptBonus;
}
