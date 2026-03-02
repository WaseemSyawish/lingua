/**
 * Store system constants — client-safe.
 * Defines store items, coin rewards, and categories.
 */

export type StoreCategory = "boosts" | "cosmetics" | "perks";

export interface StoreItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  category: StoreCategory;
  icon: string;
  levelRequired: number;
  oneTime: boolean; // true = can only buy once
}

/** Coin rewards for various activities */
export const COIN_REWARDS = {
  SESSION_COMPLETE: 15,
  LEVEL_UP: 100,
  ACHIEVEMENT_EARNED: 30,
  STREAK_MILESTONE_7: 50,
  STREAK_MILESTONE_14: 100,
  STREAK_MILESTONE_30: 200,
  DAILY_LOGIN: 5,
} as const;

/** All store items — icon is a Lucide icon component name (string) */
export const STORE_ITEMS: StoreItem[] = [
  // ── Boosts ──
  {
    id: "double-xp-1",
    name: "Double XP (1 Session)",
    description: "Earn 2× XP on your next session",
    cost: 50,
    category: "boosts",
    icon: "Zap",
    levelRequired: 1,
    oneTime: false,
  },
  {
    id: "streak-freeze",
    name: "Streak Freeze",
    description: "Protect your streak for one missed day",
    cost: 75,
    category: "boosts",
    icon: "Snowflake",
    levelRequired: 2,
    oneTime: false,
  },
  {
    id: "bonus-review",
    name: "Deep Review",
    description: "Unlock extra review insights for your next session",
    cost: 60,
    category: "boosts",
    icon: "Search",
    levelRequired: 3,
    oneTime: false,
  },
  {
    id: "hint-pack",
    name: "Hint Pack (5)",
    description: "Get 5 gentle hints during lessons when you're stuck",
    cost: 40,
    category: "boosts",
    icon: "Lightbulb",
    levelRequired: 1,
    oneTime: false,
  },
  {
    id: "xp-rush",
    name: "XP Rush (3 Sessions)",
    description: "Earn 1.5× XP for your next 3 sessions — stack up fast!",
    cost: 120,
    category: "boosts",
    icon: "TrendingUp",
    levelRequired: 4,
    oneTime: false,
  },
  {
    id: "vocab-booster",
    name: "Vocab Booster",
    description: "Tutor focuses on new vocabulary — double the word power",
    cost: 70,
    category: "boosts",
    icon: "BookOpen",
    levelRequired: 2,
    oneTime: false,
  },
  {
    id: "grammar-shield",
    name: "Grammar Shield",
    description: "Grammar errors become teaching moments, not penalties",
    cost: 65,
    category: "boosts",
    icon: "ShieldCheck",
    levelRequired: 3,
    oneTime: false,
  },

  // ── Cosmetics ──
  {
    id: "bubble-neon",
    name: "Neon Chat Bubbles",
    description: "Glowing neon-violet styled chat bubbles",
    cost: 120,
    category: "cosmetics",
    icon: "Sparkles",
    levelRequired: 5,
    oneTime: true,
  },
  {
    id: "bubble-sunset",
    name: "Sunset Chat Bubbles",
    description: "Warm amber-to-rose gradient chat bubble style",
    cost: 120,
    category: "cosmetics",
    icon: "Brush",
    levelRequired: 5,
    oneTime: true,
  },
  {
    id: "bubble-midnight",
    name: "Midnight Chat Bubbles",
    description: "Deep navy chat bubbles with a cool moonlit glow",
    cost: 150,
    category: "cosmetics",
    icon: "Moon",
    levelRequired: 6,
    oneTime: true,
  },
  {
    id: "bubble-forest",
    name: "Forest Chat Bubbles",
    description: "Earthy green tones — calm and grounded chat style",
    cost: 150,
    category: "cosmetics",
    icon: "Leaf",
    levelRequired: 6,
    oneTime: true,
  },
  {
    id: "profile-frame-gold",
    name: "Gold Profile Frame",
    description: "A shimmering golden frame around your profile avatar",
    cost: 200,
    category: "cosmetics",
    icon: "Crown",
    levelRequired: 8,
    oneTime: true,
  },
  {
    id: "profile-frame-diamond",
    name: "Diamond Profile Frame",
    description: "A sparkling diamond-blue frame for elite learners",
    cost: 400,
    category: "cosmetics",
    icon: "Gem",
    levelRequired: 12,
    oneTime: true,
  },
  {
    id: "title-polyglot",
    name: "\"Polyglot\" Title",
    description: "Display the Polyglot title on your profile",
    cost: 150,
    category: "cosmetics",
    icon: "Tag",
    levelRequired: 6,
    oneTime: true,
  },
  {
    id: "title-fluent",
    name: "\"Fluent\" Title",
    description: "Show the world you're on your way to fluency",
    cost: 250,
    category: "cosmetics",
    icon: "BadgeCheck",
    levelRequired: 10,
    oneTime: true,
  },
  {
    id: "title-master",
    name: "\"Master Linguist\" Title",
    description: "The rarest title — for dedicated language masters only",
    cost: 600,
    category: "cosmetics",
    icon: "Award",
    levelRequired: 15,
    oneTime: true,
  },

  // ── Perks ──
  {
    id: "longer-sessions",
    name: "Extended Sessions",
    description: "Unlock 25-min \"Marathon\" session length",
    cost: 250,
    category: "perks",
    icon: "Timer",
    levelRequired: 5,
    oneTime: true,
  },
  {
    id: "tutor-personality",
    name: "Tutor Mood Picker",
    description: "Choose your tutor's mood: Encouraging, Strict, or Playful",
    cost: 200,
    category: "perks",
    icon: "Smile",
    levelRequired: 7,
    oneTime: true,
  },
  {
    id: "custom-greeting",
    name: "Custom Greeting",
    description: "Set a personalized greeting for your tutor to use",
    cost: 100,
    category: "perks",
    icon: "MessageSquare",
    levelRequired: 3,
    oneTime: true,
  },
  {
    id: "focus-mode",
    name: "Focus Mode",
    description: "Tutor concentrates only on your weakest concepts",
    cost: 80,
    category: "perks",
    icon: "Target",
    levelRequired: 4,
    oneTime: true,
  },
  {
    id: "advanced-stats",
    name: "Advanced Stats",
    description: "Unlock detailed per-concept performance charts on your profile",
    cost: 150,
    category: "perks",
    icon: "BarChart3",
    levelRequired: 8,
    oneTime: true,
  },
  {
    id: "session-replay",
    name: "Session Replay",
    description: "Re-read any past session — review what your tutor said",
    cost: 200,
    category: "perks",
    icon: "RotateCcw",
    levelRequired: 10,
    oneTime: true,
  },
];

/**
 * Free perks automatically granted on level-up.
 * Every even level awards one free boost item.
 * Values are arrays of item IDs from STORE_ITEMS.
 */
export const LEVEL_UP_FREE_PERKS: Record<number, string[]> = {
  2:  ["hint-pack"],
  4:  ["double-xp-1"],
  6:  ["vocab-booster"],
  8:  ["streak-freeze"],
  10: ["xp-rush"],
  12: ["bonus-review"],
  14: ["grammar-shield"],
  16: ["hint-pack"],
  18: ["double-xp-1"],
  20: ["vocab-booster"],
  22: ["streak-freeze"],
  24: ["xp-rush"],
  26: ["bonus-review"],
  28: ["grammar-shield"],
  30: ["hint-pack"],
};

/** Get items available at a given level */
export function getAvailableItems(level: number): StoreItem[] {
  return STORE_ITEMS.filter((item) => item.levelRequired <= level);
}

/** Get items by category */
export function getItemsByCategory(category: StoreCategory): StoreItem[] {
  return STORE_ITEMS.filter((item) => item.category === category);
}

/** Category display config — icon is a Lucide icon component name */
export const STORE_CATEGORIES: { id: StoreCategory; label: string; icon: string; desc: string }[] = [
  { id: "boosts", label: "Boosts", icon: "Zap", desc: "Temporary power-ups for your sessions" },
  { id: "cosmetics", label: "Cosmetics", icon: "Palette", desc: "Personalize your learning experience" },
  { id: "perks", label: "Perks", icon: "Star", desc: "Permanent upgrades and features" },
];
