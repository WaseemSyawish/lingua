import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cefrLabel } from "@/lib/utils";
import { xpProgressInLevel, LEVEL_PERKS } from "@/lib/xp-constants";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import ReactCountryFlag from "react-country-flag";
import {
  User,
  Flame,
  MessageCircle,
  BookOpen,
  Trophy,
  Star,
  Award,
  Zap,
  Brain,
  CheckCircle2,
  TrendingUp,
  GraduationCap,
  ShoppingBag,
  Settings,
  Calendar,
  Target,
  Lock,
  HelpCircle,
  Globe,
  Heart,
  Sparkles,
  Pencil,
  Plus,
  Check,
} from "lucide-react";

interface ProfileData {
  profile: any;
  stats: {
    totalSessions: number;
    totalMessages: number;
    currentStreak: number;
    conceptsMastered: number;
    totalConceptsInLevel: number;
    levelProgress: number;
  };
  masteries: any[];
}

// ── Achievement category types for visual theming ──
type AchCategory = "learning" | "dedication" | "progression" | "cultural";

type Achievement = {
  id: string;
  family: string; // group ID for tiered achievements
  label: string;
  icon: any;
  earned: boolean;
  desc: string;
  progress: number;
  tier: "bronze" | "silver" | "gold" | "diamond" | "platinum";
  category: "standard" | "cultural" | "easter_egg";
  achCategory: AchCategory;
};

// ── Category gradient configs ──
const categoryGradients: Record<AchCategory, { bg: string; border: string; glow: string; text: string }> = {
  learning: {
    bg: "from-blue-600/20 via-purple-500/15 to-blue-400/10",
    border: "border-blue-500/30",
    glow: "shadow-blue-500/20",
    text: "text-blue-500",
  },
  dedication: {
    bg: "from-orange-600/20 via-red-500/15 to-orange-400/10",
    border: "border-orange-500/30",
    glow: "shadow-orange-500/20",
    text: "text-orange-500",
  },
  progression: {
    bg: "from-green-600/20 via-teal-500/15 to-green-400/10",
    border: "border-green-500/30",
    glow: "shadow-green-500/20",
    text: "text-green-500",
  },
  cultural: {
    bg: "from-amber-500/25 via-yellow-500/15 to-amber-400/10",
    border: "border-amber-500/30",
    glow: "shadow-amber-500/20",
    text: "text-amber-500",
  },
};

// ── Metallic tier badge configs ──
const tierBadge: Record<string, { bg: string; text: string; ring: string; label: string }> = {
  bronze: {
    bg: "bg-gradient-to-br from-orange-800 via-orange-600 to-orange-700",
    text: "text-orange-100",
    ring: "ring-orange-500/40",
    label: "Bronze",
  },
  silver: {
    bg: "bg-gradient-to-br from-slate-400 via-slate-300 to-slate-500",
    text: "text-slate-800",
    ring: "ring-slate-400/40",
    label: "Silver",
  },
  gold: {
    bg: "bg-gradient-to-br from-yellow-500 via-amber-400 to-yellow-600",
    text: "text-amber-900",
    ring: "ring-yellow-400/50",
    label: "Gold",
  },
  diamond: {
    bg: "bg-gradient-to-br from-cyan-400 via-blue-400 to-cyan-300",
    text: "text-cyan-950",
    ring: "ring-cyan-400/50",
    label: "Diamond",
  },
  platinum: {
    bg: "bg-gradient-to-br from-slate-200 via-white to-slate-300",
    text: "text-slate-700",
    ring: "ring-slate-300/50",
    label: "Platinum",
  },
};

// ── Achievement family definitions (for tiered modal view) ──
const ACHIEVEMENT_FAMILIES: { family: string; label: string; achCategory: AchCategory; tiers: { tier: "bronze" | "silver" | "gold" | "diamond"; label: string; desc: string; icon: any; threshold: (s: any, m: any) => boolean; progressFn: (s: any, m: any) => number }[] }[] = [
  {
    family: "sessions", label: "Session Milestones", achCategory: "learning",
    tiers: [
      { tier: "bronze", label: "First Steps", desc: "Complete your first session", icon: Star, threshold: (s) => s.totalSessions >= 1, progressFn: (s) => Math.min(100, (s.totalSessions / 1) * 100) },
      { tier: "silver", label: "Dedicated", desc: "Complete 10 sessions", icon: Award, threshold: (s) => s.totalSessions >= 10, progressFn: (s) => Math.min(100, (s.totalSessions / 10) * 100) },
      { tier: "gold", label: "Veteran", desc: "Complete 25 sessions", icon: GraduationCap, threshold: (s) => s.totalSessions >= 25, progressFn: (s) => Math.min(100, (s.totalSessions / 25) * 100) },
      { tier: "diamond", label: "Linguist", desc: "Complete 50 sessions", icon: Trophy, threshold: (s) => s.totalSessions >= 50, progressFn: (s) => Math.min(100, (s.totalSessions / 50) * 100) },
    ],
  },
  {
    family: "streak", label: "Streak Milestones", achCategory: "dedication",
    tiers: [
      { tier: "bronze", label: "On Fire", desc: "3-day practice streak", icon: Flame, threshold: (s) => s.currentStreak >= 3, progressFn: (s) => Math.min(100, (s.currentStreak / 3) * 100) },
      { tier: "silver", label: "Unstoppable", desc: "7-day practice streak", icon: Zap, threshold: (s) => s.currentStreak >= 7, progressFn: (s) => Math.min(100, (s.currentStreak / 7) * 100) },
      { tier: "gold", label: "Relentless", desc: "14-day practice streak", icon: Flame, threshold: (s) => s.currentStreak >= 14, progressFn: (s) => Math.min(100, (s.currentStreak / 14) * 100) },
      { tier: "diamond", label: "Unbreakable", desc: "30-day practice streak", icon: Flame, threshold: (s) => s.currentStreak >= 30, progressFn: (s) => Math.min(100, (s.currentStreak / 30) * 100) },
    ],
  },
  {
    family: "mastery", label: "Mastery Milestones", achCategory: "progression",
    tiers: [
      { tier: "bronze", label: "Grammar Starter", desc: "Master 3 grammar concepts", icon: Brain, threshold: (_s, m) => m.grammarMastered >= 3, progressFn: (_s, m) => Math.min(100, (m.grammarMastered / 3) * 100) },
      { tier: "silver", label: "Scholar", desc: "Master 10 concepts total", icon: Brain, threshold: (s) => s.conceptsMastered >= 10, progressFn: (s) => Math.min(100, (s.conceptsMastered / 10) * 100) },
      { tier: "gold", label: "Polymath", desc: "Master 20 concepts total", icon: Brain, threshold: (s) => s.conceptsMastered >= 20, progressFn: (s) => Math.min(100, (s.conceptsMastered / 20) * 100) },
      { tier: "diamond", label: "High Achiever", desc: "Master 40 concepts total", icon: Trophy, threshold: (s) => s.conceptsMastered >= 40, progressFn: (s) => Math.min(100, (s.conceptsMastered / 40) * 100) },
    ],
  },
  {
    family: "messages", label: "Communication Milestones", achCategory: "learning",
    tiers: [
      { tier: "bronze", label: "Talkative", desc: "Send 50 messages", icon: MessageCircle, threshold: (s) => s.totalMessages >= 50, progressFn: (s) => Math.min(100, (s.totalMessages / 50) * 100) },
      { tier: "silver", label: "Chatterbox", desc: "Send 200 messages", icon: MessageCircle, threshold: (s) => s.totalMessages >= 200, progressFn: (s) => Math.min(100, (s.totalMessages / 200) * 100) },
      { tier: "gold", label: "Eloquent", desc: "Send 500 messages", icon: MessageCircle, threshold: (s) => s.totalMessages >= 500, progressFn: (s) => Math.min(100, (s.totalMessages / 500) * 100) },
      { tier: "diamond", label: "Orator", desc: "Send 1000 messages", icon: MessageCircle, threshold: (s) => s.totalMessages >= 1000, progressFn: (s) => Math.min(100, (s.totalMessages / 1000) * 100) },
    ],
  },
];

// ── Cultural achievement families per language (fun & language-specific) ──
const CULTURAL_FAMILIES: Record<string, typeof ACHIEVEMENT_FAMILIES> = {
  fr: [
    {
      family: "cultural-fr-journey", label: "French Journey", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "Bonjour Buddy", desc: "Have 3 chats with Amélie", icon: Heart, threshold: (s) => s.totalSessions >= 3, progressFn: (s) => Math.min(100, (s.totalSessions / 3) * 100) },
        { tier: "silver", label: "Café Régulier", desc: "10 sessions — coffee's on Amélie!", icon: Star, threshold: (s) => s.totalSessions >= 10, progressFn: (s) => Math.min(100, (s.totalSessions / 10) * 100) },
        { tier: "gold", label: "Tour de France", desc: "25 French sessions completed", icon: Globe, threshold: (s) => s.totalSessions >= 25, progressFn: (s) => Math.min(100, (s.totalSessions / 25) * 100) },
        { tier: "diamond", label: "Parisian Native", desc: "50 sessions — vous êtes chez vous!", icon: Trophy, threshold: (s) => s.totalSessions >= 50, progressFn: (s) => Math.min(100, (s.totalSessions / 50) * 100) },
      ],
    },
    {
      family: "cultural-fr-mastery", label: "French Mastery", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "Baguette Brain", desc: "Master 3 concepts — c'est un début!", icon: Brain, threshold: (s) => s.conceptsMastered >= 3, progressFn: (s) => Math.min(100, (s.conceptsMastered / 3) * 100) },
        { tier: "silver", label: "Croissant Scholar", desc: "Master 8 concepts — flaky outside, sharp inside", icon: Award, threshold: (s) => s.conceptsMastered >= 8, progressFn: (s) => Math.min(100, (s.conceptsMastered / 8) * 100) },
        { tier: "gold", label: "Louvre Linguist", desc: "15 concepts mastered — a work of art!", icon: GraduationCap, threshold: (s) => s.conceptsMastered >= 15, progressFn: (s) => Math.min(100, (s.conceptsMastered / 15) * 100) },
        { tier: "diamond", label: "Haute Couture du Français", desc: "70%+ avg mastery — magnifique!", icon: Trophy, threshold: (_s, m) => m.avgMastery >= 0.7, progressFn: (_s, m) => Math.min(100, (m.avgMastery / 0.7) * 100) },
      ],
    },
  ],
  es: [
    {
      family: "cultural-es-journey", label: "Spanish Journey", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "¡Hola Amigo!", desc: "Have 3 chats with Sofía", icon: Heart, threshold: (s) => s.totalSessions >= 3, progressFn: (s) => Math.min(100, (s.totalSessions / 3) * 100) },
        { tier: "silver", label: "Tapas Tertuliano", desc: "10 sessions — ¡buen provecho!", icon: Star, threshold: (s) => s.totalSessions >= 10, progressFn: (s) => Math.min(100, (s.totalSessions / 10) * 100) },
        { tier: "gold", label: "Fiesta Fluente", desc: "25 Spanish sessions completed", icon: Globe, threshold: (s) => s.totalSessions >= 25, progressFn: (s) => Math.min(100, (s.totalSessions / 25) * 100) },
        { tier: "diamond", label: "El Conquistador", desc: "50 sessions — ¡eres un maestro!", icon: Trophy, threshold: (s) => s.totalSessions >= 50, progressFn: (s) => Math.min(100, (s.totalSessions / 50) * 100) },
      ],
    },
    {
      family: "cultural-es-mastery", label: "Spanish Mastery", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "Churro Champion", desc: "Master 3 concepts — ¡dulce!", icon: Brain, threshold: (s) => s.conceptsMastered >= 3, progressFn: (s) => Math.min(100, (s.conceptsMastered / 3) * 100) },
        { tier: "silver", label: "Flamenco Phrasist", desc: "Master 8 concepts — ¡olé!", icon: Award, threshold: (s) => s.conceptsMastered >= 8, progressFn: (s) => Math.min(100, (s.conceptsMastered / 8) * 100) },
        { tier: "gold", label: "Alhambra Academic", desc: "15 concepts — a palace of knowledge!", icon: GraduationCap, threshold: (s) => s.conceptsMastered >= 15, progressFn: (s) => Math.min(100, (s.conceptsMastered / 15) * 100) },
        { tier: "diamond", label: "Sol y Saber", desc: "70%+ avg mastery — ¡brillante!", icon: Trophy, threshold: (_s, m) => m.avgMastery >= 0.7, progressFn: (_s, m) => Math.min(100, (m.avgMastery / 0.7) * 100) },
      ],
    },
  ],
  de: [
    {
      family: "cultural-de-journey", label: "German Journey", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "Hallo Freund!", desc: "Have 3 chats with Hans", icon: Heart, threshold: (s) => s.totalSessions >= 3, progressFn: (s) => Math.min(100, (s.totalSessions / 3) * 100) },
        { tier: "silver", label: "Kaffeeklatsch König", desc: "10 sessions — Prost!", icon: Star, threshold: (s) => s.totalSessions >= 10, progressFn: (s) => Math.min(100, (s.totalSessions / 10) * 100) },
        { tier: "gold", label: "Autobahn Akademiker", desc: "25 German sessions — Vollgas!", icon: Globe, threshold: (s) => s.totalSessions >= 25, progressFn: (s) => Math.min(100, (s.totalSessions / 25) * 100) },
        { tier: "diamond", label: "Deutsche Meister", desc: "50 sessions — du bist ein Profi!", icon: Trophy, threshold: (s) => s.totalSessions >= 50, progressFn: (s) => Math.min(100, (s.totalSessions / 50) * 100) },
      ],
    },
    {
      family: "cultural-de-mastery", label: "German Mastery", achCategory: "cultural",
      tiers: [
        { tier: "bronze", label: "Pretzel Professor", desc: "Master 3 concepts — gut gemacht!", icon: Brain, threshold: (s) => s.conceptsMastered >= 3, progressFn: (s) => Math.min(100, (s.conceptsMastered / 3) * 100) },
        { tier: "silver", label: "Biergarten Babbler", desc: "Master 8 concepts — Wunderbar!", icon: Award, threshold: (s) => s.conceptsMastered >= 8, progressFn: (s) => Math.min(100, (s.conceptsMastered / 8) * 100) },
        { tier: "gold", label: "Neuschwanstein Nerd", desc: "15 concepts — a fairytale of knowledge!", icon: GraduationCap, threshold: (s) => s.conceptsMastered >= 15, progressFn: (s) => Math.min(100, (s.conceptsMastered / 15) * 100) },
        { tier: "diamond", label: "Zeitgeist Guru", desc: "70%+ avg mastery — ausgezeichnet!", icon: Trophy, threshold: (_s, m) => m.avgMastery >= 0.7, progressFn: (_s, m) => Math.min(100, (m.avgMastery / 0.7) * 100) },
      ],
    },
  ],
};

function getAchievements(stats: ProfileData["stats"] | undefined, masteries: any[] = [], targetLang: string = "fr") {
  if (!stats) return { standard: [] as Achievement[], cultural: [] as Achievement[], easterEggs: [] as Achievement[], earnedBadges: [] as Achievement[] };

  const grammarMastered = masteries.filter((m) => m.conceptType === "GRAMMAR" && m.masteryScore >= 0.7).length;
  const vocabMastered = masteries.filter((m) => m.conceptType === "VOCABULARY" && m.masteryScore >= 0.7).length;
  const avgMastery = masteries.length > 0
    ? masteries.reduce((sum: number, m: any) => sum + m.masteryScore, 0) / masteries.length
    : 0;

  const masteryMeta = { grammarMastered, vocabMastered, avgMastery };

  // Helper: pick one representative per family (highest earned tier, or first if none earned)
  const pickRep = (fam: typeof ACHIEVEMENT_FAMILIES[number], cat: Achievement["category"]): Achievement => {
    let repIdx = 0;
    for (let i = fam.tiers.length - 1; i >= 0; i--) {
      if (fam.tiers[i].threshold(stats!, masteryMeta)) { repIdx = i; break; }
    }
    const t = fam.tiers[repIdx];
    return {
      id: `${fam.family}-${t.tier}`, family: fam.family, label: t.label, icon: t.icon,
      earned: t.threshold(stats!, masteryMeta), desc: t.desc, progress: t.progressFn(stats!, masteryMeta),
      tier: t.tier, category: cat, achCategory: fam.achCategory,
    };
  };

  // Build standard achievements: ONE card per family (click to see all tiers)
  const standard: Achievement[] = ACHIEVEMENT_FAMILIES.map((f) => pickRep(f, "standard"));

  // Extra standalone achievements
  standard.push(
    { id: "vocab-collector", family: "vocab", label: "Word Collector", icon: BookOpen, earned: vocabMastered >= 3, desc: "Master 3 vocabulary groups", progress: Math.min(100, (vocabMastered / 3) * 100), tier: vocabMastered >= 3 ? "platinum" : "diamond", category: "standard", achCategory: "learning" },
    { id: "level-up", family: "level", label: "Level Up", icon: TrendingUp, earned: stats.levelProgress >= 60, desc: "Reach 60% level progress", progress: Math.min(100, (stats.levelProgress / 60) * 100), tier: stats.levelProgress >= 60 ? "platinum" : "diamond", category: "standard", achCategory: "progression" },
  );

  // Cultural achievements: ONE card per cultural family + standalone extras
  const culturalFams = CULTURAL_FAMILIES[targetLang] || CULTURAL_FAMILIES.fr;
  const cultural: Achievement[] = culturalFams.map((f) => pickRep(f, "cultural"));
  const tutorNames: Record<string, string> = { fr: "Amélie", es: "Sofía", de: "Hans" };
  const tName = tutorNames[targetLang] || "Amélie";
  cultural.push(
    { id: `${targetLang}-devoted`, family: `cultural-${targetLang}-devoted`, label: `${tName}'s Favorite`, icon: Heart, earned: stats!.currentStreak >= 7, desc: `7-day streak — ${tName} is impressed!`, progress: Math.min(100, (stats!.currentStreak / 7) * 100), tier: stats!.currentStreak >= 7 ? "platinum" : "diamond", category: "cultural", achCategory: "cultural" },
    { id: `${targetLang}-star`, family: `cultural-${targetLang}-star`, label: "Star Student", icon: Sparkles, earned: stats!.levelProgress >= 60, desc: "Reach 60% level progress", progress: Math.min(100, (stats!.levelProgress / 60) * 100), tier: stats!.levelProgress >= 60 ? "platinum" : "diamond", category: "cultural", achCategory: "cultural" },
  );

  // Easter eggs
  const easterEggs: Achievement[] = Array.from({ length: 8 }, (_, i) => ({
    id: `egg-${i}`,
    family: `egg-${i}`,
    label: "???",
    icon: HelpCircle,
    earned: false,
    desc: "Hidden achievement",
    progress: 0,
    tier: "diamond" as const,
    category: "easter_egg" as const,
    achCategory: "cultural" as const,
  }));

  const sortAch = (arr: Achievement[]) => {
    const earned = arr.filter((a) => a.earned);
    const inProgress = arr.filter((a) => !a.earned && a.progress > 0).sort((a, b) => b.progress - a.progress);
    const locked = arr.filter((a) => !a.earned && a.progress === 0);
    return [...earned, ...inProgress, ...locked];
  };

  // Collect ALL individually earned tier badges (for badge showcase)
  const earnedBadges: Achievement[] = [];
  const allCulturalFams = culturalFams as typeof ACHIEVEMENT_FAMILIES;
  const allFamilyGroups = [...ACHIEVEMENT_FAMILIES, ...allCulturalFams];
  for (const f of allFamilyGroups) {
    const cat: Achievement["category"] = f.achCategory === "cultural" ? "cultural" : "standard";
    for (const t of f.tiers) {
      if (t.threshold(stats!, masteryMeta)) {
        earnedBadges.push({
          id: `${f.family}-badge-${t.tier}`,
          family: f.family,
          label: t.label,
          icon: t.icon,
          earned: true,
          desc: t.desc,
          progress: 100,
          tier: t.tier,
          category: cat,
          achCategory: f.achCategory,
        });
      }
    }
  }
  // Add earned standalone achievements
  const standaloneFamilies = new Set(allFamilyGroups.map((f) => f.family));
  for (const a of [...standard, ...cultural]) {
    if (a.earned && !standaloneFamilies.has(a.family)) {
      earnedBadges.push(a);
    }
  }
  // Sort: diamond > gold > silver > bronze > platinum (standalone completed)
  const tierWeight: Record<string, number> = { diamond: 0, gold: 1, silver: 2, bronze: 3, platinum: 4 };
  earnedBadges.sort((a, b) => (tierWeight[a.tier] ?? 5) - (tierWeight[b.tier] ?? 5));

  return { standard: sortAch(standard), cultural: sortAch(cultural), easterEggs, earnedBadges };
}

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-32 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}

// ── Collectible Achievement Card ──
function AchievementCard({ ach, index, onClick }: { ach: Achievement; index: number; onClick: () => void }) {
  const Icon = ach.icon;
  const catStyle = categoryGradients[ach.achCategory];
  const badge = tierBadge[ach.tier];
  const isEarned = ach.earned;
  const isInProgress = !isEarned && ach.progress > 0;
  const isLocked = !isEarned && ach.progress === 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.03, duration: 0.3 }}
    >
      <button
        onClick={onClick}
        className={`w-full text-left transition-all duration-300 rounded-xl overflow-hidden relative group ${
          isEarned
            ? `shadow-lg ${catStyle.glow} ring-1 ${catStyle.border}`
            : isInProgress
              ? `ring-1 ${catStyle.border} opacity-80`
              : "opacity-40 ring-1 ring-border/30"
        }`}
      >
        {/* Card body */}
        <div className={`p-3 sm:p-3.5 relative ${
          isEarned
            ? `bg-gradient-to-br ${catStyle.bg}`
            : isInProgress
              ? `bg-gradient-to-br ${catStyle.bg} saturate-50`
              : "bg-muted/20"
        }`}>
          {/* Earned glow overlay */}
          {isEarned && (
            <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent pointer-events-none" />
          )}

          {/* Metallic tier badge — top right */}
          <div className={`absolute top-2 right-2 px-1.5 py-0.5 rounded-md text-[8px] font-black ${badge.bg} ${badge.text} ring-1 ${badge.ring} shadow-sm`}>
            {badge.label}
          </div>

          {/* Icon + Info */}
          <div className="flex items-center gap-2.5 mb-2.5 pr-14">
            <div className={`relative size-10 rounded-xl flex items-center justify-center shrink-0 ${
              isEarned
                ? `bg-gradient-to-br ${catStyle.bg} ring-1 ${catStyle.border}`
                : isInProgress
                  ? "bg-muted/40 ring-1 ring-border/30"
                  : "bg-muted/20 ring-1 ring-border/20"
            }`}>
              <Icon className={`size-5 ${
                isEarned ? catStyle.text : "text-muted-foreground/50"
              }`} />
              {isEarned && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.3 + index * 0.03, type: "spring" }}
                >
                  <div className={`size-4 rounded-full flex items-center justify-center ring-2 ring-background shadow-sm ${badge.bg}`}>
                    <CheckCircle2 className={`size-2.5 ${badge.text}`} />
                  </div>
                </motion.div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-bold leading-tight truncate ${isEarned ? "" : "text-muted-foreground"}`}>
                {ach.label}
              </p>
              <p className="text-[9px] text-muted-foreground leading-tight truncate mt-0.5">
                {ach.desc}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full ${
                isEarned
                  ? `bg-gradient-to-r ${
                      ach.achCategory === "learning" ? "from-blue-400 to-purple-400" :
                      ach.achCategory === "dedication" ? "from-orange-400 to-red-400" :
                      ach.achCategory === "progression" ? "from-green-400 to-teal-400" :
                      "from-amber-400 to-yellow-400"
                    }`
                  : "bg-foreground/20"
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${ach.progress}%` }}
              transition={{ delay: 0.3 + index * 0.03, duration: 0.5 }}
            />
          </div>
          {isEarned ? (
            <p className={`text-[10px] font-bold text-right mt-1 ${catStyle.text}`}>Earned!</p>
          ) : isInProgress ? (
            <p className="text-[10px] text-muted-foreground font-medium text-right mt-1">{Math.round(ach.progress)}%</p>
          ) : null}
        </div>
      </button>
    </motion.div>
  );
}

function AchievementGrid({ items, onSelect }: { items: Achievement[]; onSelect: (ach: Achievement) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
      {items.map((ach, i) => (
        <AchievementCard key={ach.id} ach={ach} index={i} onClick={() => onSelect(ach)} />
      ))}
    </div>
  );
}

// ── Achievement Detail Modal ──
function AchievementModal({ ach, stats, masteries, targetLang, open, onClose }: {
  ach: Achievement | null;
  stats: ProfileData["stats"] | undefined;
  masteries: any[];
  targetLang: string;
  open: boolean;
  onClose: () => void;
}) {
  if (!ach || !stats) return null;

  const grammarMastered = masteries.filter((m) => m.conceptType === "GRAMMAR" && m.masteryScore >= 0.7).length;
  const vocabMastered = masteries.filter((m) => m.conceptType === "VOCABULARY" && m.masteryScore >= 0.7).length;
  const avgMastery = masteries.length > 0
    ? masteries.reduce((sum: number, m: any) => sum + m.masteryScore, 0) / masteries.length
    : 0;
  const masteryMeta = { grammarMastered, vocabMastered, avgMastery };

  // Find the family for this achievement (search standard + cultural families)
  const family = ACHIEVEMENT_FAMILIES.find((f) => f.family === ach.family)
    || (CULTURAL_FAMILIES[targetLang] || []).find((f: any) => f.family === ach.family);
  const catStyle = categoryGradients[ach.achCategory];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className={`size-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${catStyle.bg}`}>
              {(() => { const I = ach.icon; return <I className={`size-4 ${catStyle.text}`} />; })()}
            </div>
            {family ? family.label : ach.label}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {family ? (
            // Show all 4 tiers in the family
            family.tiers.map((t) => {
              const isEarned = t.threshold(stats, masteryMeta);
              const progress = t.progressFn(stats, masteryMeta);
              const badge = tierBadge[t.tier];
              const TierIcon = t.icon;
              return (
                <div
                  key={t.tier}
                  className={`p-3 rounded-lg border transition-all ${
                    isEarned
                      ? `${catStyle.border} bg-gradient-to-r ${catStyle.bg}`
                      : "border-border/50 bg-muted/10"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-10 rounded-xl flex items-center justify-center ${
                      isEarned ? `bg-gradient-to-br ${catStyle.bg} ring-1 ${catStyle.border}` : "bg-muted/30"
                    }`}>
                      <TierIcon className={`size-4 ${isEarned ? catStyle.text : "text-muted-foreground/50"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-bold ${isEarned ? "" : "text-muted-foreground"}`}>{t.label}</p>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        {isEarned && <CheckCircle2 className={`size-3.5 ${catStyle.text}`} />}
                      </div>
                      <p className="text-[11px] text-muted-foreground">{t.desc}</p>
                    </div>
                    <span className={`text-xs font-bold ${isEarned ? catStyle.text : "text-muted-foreground"}`}>
                      {Math.round(progress)}%
                    </span>
                  </div>
                  <Progress value={progress} className="h-1.5 mt-2" />
                </div>
              );
            })
          ) : (
            // Single achievement, no family
            <div className={`p-4 rounded-lg border ${ach.earned ? `${catStyle.border} bg-gradient-to-r ${catStyle.bg}` : "border-border/50"}`}>
              <div className="flex items-center gap-3 mb-3">
                {(() => { const I = ach.icon; return <I className={`size-6 ${ach.earned ? catStyle.text : "text-muted-foreground"}`} />; })()}
                <div>
                  <p className="font-bold">{ach.label}</p>
                  <p className="text-xs text-muted-foreground">{ach.desc}</p>
                </div>
                <span className={`ml-auto px-2 py-0.5 rounded text-[9px] font-black ${tierBadge[ach.tier].bg} ${tierBadge[ach.tier].text}`}>
                  {tierBadge[ach.tier].label}
                </span>
              </div>
              <Progress value={ach.progress} className="h-2" />
              <p className={`text-xs font-bold text-right mt-1 ${ach.earned ? catStyle.text : "text-muted-foreground"}`}>
                {ach.earned ? "Earned!" : `${Math.round(ach.progress)}%`}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [xpData, setXpData] = useState<{ xp: number; level: number; progress: { current: number; needed: number; percent: number } } | null>(null);
  const [selectedAch, setSelectedAch] = useState<Achievement | null>(null);
  const [pinnedAchIds, setPinnedAchIds] = useState<string[]>([]);
  const [showPinDialog, setShowPinDialog] = useState(false);

  const targetLang = session?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  // Load pinned achievement IDs from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("lingua-pinned-achs");
      if (saved) setPinnedAchIds(JSON.parse(saved));
    } catch {}
  }, []);

  // Persist pinned IDs whenever they change
  useEffect(() => {
    try {
      localStorage.setItem("lingua-pinned-achs", JSON.stringify(pinnedAchIds));
    } catch {}
  }, [pinnedAchIds]);

  useEffect(() => {
    if (session?.user) {
      Promise.all([
        fetch("/api/progress").then((r) => r.ok ? r.json() : null),
        fetch("/api/xp").then((r) => r.ok ? r.json() : null),
      ]).then(([progressData, xp]) => {
        if (progressData) setData(progressData);
        if (xp) setXpData(xp);
      }).catch(() => {}).finally(() => setLoading(false));
    }
  }, [session]);

  if (status === "loading" || loading) {
    return <Layout><SEO title="Profile" /><ProfileSkeleton /></Layout>;
  }
  if (!session) return null;

  const stats = data?.stats;
  const profile = data?.profile;
  const achievements = getAchievements(stats, data?.masteries || [], targetLang);
  const allFlat = [...achievements.standard, ...achievements.cultural];
  const earnedCount = allFlat.filter((a) => a.earned).length;
  const totalCount = allFlat.length;

  // Badge showcase: all individually earned tier badges across all families
  const badgeShowcase = achievements.earnedBadges.slice(0, 12);

  // Next CEFR level label
  const cefrOrder = ["A0", "A1", "A2", "B1", "B2", "C1", "C2"];
  const currentIdx = cefrOrder.indexOf(profile?.currentLevel || "A0");
  const nextLevel = currentIdx < cefrOrder.length - 1 ? cefrOrder[currentIdx + 1] : null;

  return (
    <Layout>
      <SEO title="Profile" />
      <div className="space-y-5">
        {/* Profile Header — Player Card */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Card className="overflow-hidden border-0 shadow-2xl">
            <div className="relative bg-gradient-to-br from-violet-100 via-violet-200 to-slate-200 dark:from-violet-700 dark:via-violet-900 dark:to-slate-900">
              <div className="absolute inset-0 opacity-[0.07]" style={{
                backgroundImage: `repeating-linear-gradient(-45deg, transparent, transparent 12px, rgba(255,255,255,0.1) 12px, rgba(255,255,255,0.1) 13px)`
              }} />
              <div className="absolute top-0 right-0 size-56 bg-violet-500/20 rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-0 size-40 bg-blue-500/15 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4 pointer-events-none" />
              <div className="absolute top-1/2 right-1/3 size-24 bg-fuchsia-500/12 rounded-full blur-2xl pointer-events-none" />
              <CardContent className="relative p-6 sm:p-8">
                <div className="flex items-center gap-5 sm:gap-6">
                  <div className="relative shrink-0">
                    <div className="absolute -inset-2.5 rounded-2xl bg-gradient-to-br from-violet-400/50 via-fuchsia-500/40 to-blue-500/50 blur-lg animate-pulse" />
                    <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-violet-400 via-fuchsia-500 to-blue-500 opacity-60" />
                    <div className="relative size-20 sm:size-24 rounded-2xl bg-gradient-to-br from-violet-600 to-violet-800 flex items-center justify-center shadow-2xl shadow-violet-500/40 ring-1 ring-white/20">
                      <span className="text-4xl sm:text-5xl font-black text-white drop-shadow-lg">
                        {session.user?.name?.charAt(0).toUpperCase() || "U"}
                      </span>
                    </div>
                    <div className="absolute -bottom-3 -right-3">
                      <div className="absolute inset-0 bg-amber-400/40 rounded-xl blur-md scale-125" />
                      <div className="relative px-3 py-1 rounded-xl bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-sm font-black text-amber-950 shadow-lg shadow-amber-500/40 ring-2 ring-background">
                        {profile?.currentLevel || "A0"}
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-violet-950 dark:text-white mb-1">
                      {session.user?.name || "Learner"}
                    </h1>
                    <p className="text-sm text-violet-600/70 dark:text-violet-200/70">{session.user?.email}</p>
                    <div className="flex items-center gap-2.5 mt-3 flex-wrap">
                      <Badge className="bg-violet-900/10 text-violet-900 dark:bg-white/10 dark:text-white border-violet-900/15 dark:border-white/15 font-bold px-3 py-1 text-xs shadow-sm backdrop-blur-sm">
                        <GraduationCap className="size-3.5 mr-1.5" />
                        {cefrLabel(profile?.currentLevel || "A0")}
                      </Badge>
                      <div className="flex items-center gap-2 bg-violet-900/10 dark:bg-white/10 backdrop-blur-sm rounded-full px-3 py-1 border border-violet-900/10 dark:border-white/10">
                        <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "1.1rem", height: "1.1rem" }} className="rounded-sm" />
                        <span className="text-xs font-semibold text-violet-900/90 dark:text-white/90">Learning {tutor.language} with {tutor.name}</span>
                      </div>
                      {xpData && (
                        <Badge className="bg-primary/20 text-primary dark:text-primary-foreground border-primary/30 font-bold px-3 py-1 text-xs backdrop-blur-sm">
                          <Zap className="size-3.5 mr-1.5 text-yellow-500 dark:text-yellow-300" />
                          Level {xpData.level}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-1.5 border-violet-900/15 text-violet-900 dark:border-white/15 dark:text-white hover:bg-violet-900/10 dark:hover:bg-white/10 hover:text-violet-900 dark:hover:text-white" onClick={() => router.push("/settings")}>
                    <Settings className="size-3.5" />
                    Edit
                  </Button>
                </div>

                {/* Badge showcase in hero */}
                {stats && (() => {
                  const pinnedAchs = pinnedAchIds
                    .map((id) => achievements.earnedBadges.find((a) => a.id === id))
                    .filter(Boolean) as Achievement[];
                  // Show pinned if any, otherwise show top earned badges
                  const displayBadges = pinnedAchs.length > 0 ? pinnedAchs : achievements.earnedBadges.slice(0, 3);
                  const hasBadges = displayBadges.length > 0;
                  return (
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-[10px] text-violet-800/40 dark:text-white/40 font-semibold tracking-widest uppercase">
                          {pinnedAchs.length > 0 ? "Pinned Badges" : hasBadges ? "Earned Badges" : "Badges"}
                        </span>
                        <button
                          onClick={() => setShowPinDialog(true)}
                          className="flex items-center gap-1 text-[10px] text-violet-800/50 dark:text-white/50 hover:text-violet-800/80 dark:hover:text-white/80 transition-colors"
                        >
                          <Pencil className="size-2.5" />
                          Customize
                        </button>
                      </div>
                      {hasBadges ? (
                        <div className="grid grid-cols-3 gap-3">
                          {displayBadges.map((ach) => {
                            const PAchIcon = ach.icon;
                            const pBadge = tierBadge[ach.tier];
                            return (
                              <div key={ach.id} className="rounded-xl p-3 bg-gradient-to-b from-white/40 to-white/20 dark:from-white/8 dark:to-white/3 backdrop-blur-sm border border-violet-900/10 dark:border-white/10">
                                <div className={`size-7 rounded-lg flex items-center justify-center ${pBadge.bg} mb-1.5`}>
                                  <PAchIcon className={`size-3.5 ${pBadge.text}`} />
                                </div>
                                <p className="text-[10px] font-black text-violet-950 dark:text-white leading-tight truncate">{ach.label}</p>
                                <span className={`text-[8px] font-black px-1 py-0.5 rounded mt-0.5 inline-block ${pBadge.bg} ${pBadge.text}`}>
                                  {pBadge.label}
                                </span>
                              </div>
                            );
                          })}
                          {pinnedAchs.length > 0 && Array.from({ length: Math.max(0, 3 - pinnedAchs.length) }).map((_, i) => (
                            <button
                              key={`empty-${i}`}
                              onClick={() => setShowPinDialog(true)}
                              className="rounded-xl p-3 bg-white/20 dark:bg-white/5 border border-violet-900/10 dark:border-white/[0.15] border-dashed flex flex-col items-center justify-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
                            >
                              <Plus className="size-4 text-violet-800/60 dark:text-white/60" />
                              <span className="text-[9px] text-violet-800/40 dark:text-white/40">Add</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-xl p-4 bg-white/30 dark:bg-white/5 backdrop-blur-sm border border-violet-900/10 dark:border-white/10 text-center">
                          <Trophy className="size-5 text-violet-400/60 dark:text-white/30 mx-auto mb-1.5" />
                          <p className="text-[11px] font-semibold text-violet-800/60 dark:text-white/50">No badges earned yet</p>
                          <p className="text-[9px] text-violet-700/40 dark:text-white/30 mt-0.5">Complete sessions to earn your first badge!</p>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* XP Progress */}
        {xpData && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}>
            <Card className="border-primary/10 bg-gradient-to-r from-primary/3 to-primary/8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Zap className="size-4 text-primary" />
                    <span className="text-sm font-semibold">XP Level {xpData.level}</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{xpData.xp.toLocaleString()} XP</span>
                </div>
                <Progress value={xpData.progress.percent} className="h-2.5 mb-1.5" />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground">
                    {xpData.progress.current} / {xpData.progress.needed} XP to next level
                  </p>
                  {LEVEL_PERKS.find((p) => xpData.level < p.level) && (
                    <p className="text-[10px] text-primary font-medium">
                      Next perk: {LEVEL_PERKS.find((p) => xpData.level < p.level)!.icon} {LEVEL_PERKS.find((p) => xpData.level < p.level)!.label} at L{LEVEL_PERKS.find((p) => xpData.level < p.level)!.level}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Level Progress */}
        {stats && stats.levelProgress > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target className="size-4 text-primary" />
                    <span className="text-sm font-semibold">Level Progress</span>
                  </div>
                  <span className="text-sm font-bold text-primary">{stats.levelProgress}%</span>
                </div>
                <Progress value={stats.levelProgress} className="h-2.5 mb-1.5" />
                <p className="text-[10px] text-muted-foreground">
                  {nextLevel
                    ? `Path to ${nextLevel} — master 60% of ${cefrLabel(profile?.currentLevel || "A0")} concepts to advance`
                    : `${stats.conceptsMastered} of ${stats.totalConceptsInLevel} concepts mastered — max level reached!`
                  }
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Badge Showcase */}
        {badgeShowcase.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4 }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-4 text-amber-500" />
              <h2 className="text-sm font-bold">Badge Showcase</h2>
            </div>
            <div className="flex gap-2.5 overflow-x-auto pb-1">
              {badgeShowcase.map((ach) => {
                const Icon = ach.icon;
                const catStyle = categoryGradients[ach.achCategory];
                const badge = tierBadge[ach.tier];
                return (
                  <button
                    key={ach.id}
                    onClick={() => setSelectedAch(ach)}
                    className="shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl bg-card border shadow-lg transition-all hover:scale-[1.03] active:scale-[0.98] hover:shadow-xl"
                  >
                    <div className={`size-10 rounded-xl flex items-center justify-center ${badge.bg} ring-2 ring-background shadow-md`}>
                      <Icon className={`size-5 ${badge.text}`} />
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-bold leading-tight">{ach.label}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                        <span className={`text-[9px] font-semibold ${catStyle.text} capitalize`}>
                          {ach.achCategory === "learning" ? "Learning" : ach.achCategory === "dedication" ? "Dedication" : ach.achCategory === "progression" ? "Progress" : "Cultural"}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Achievements Grid — Tabbed */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Award className="size-4 text-amber-500" />
              </div>
              Achievements
            </h2>
            <Badge variant="secondary" className="text-[10px] font-bold px-2">
              {earnedCount}/{totalCount} earned
            </Badge>
          </div>

          <Tabs defaultValue="standard" className="w-full">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="standard" className="flex-1 text-xs gap-1.5">
                <Trophy className="size-3" />
                Standard
              </TabsTrigger>
              <TabsTrigger value="cultural" className="flex-1 text-xs gap-1.5">
                <Globe className="size-3" />
                Cultural
              </TabsTrigger>
              <TabsTrigger value="mysteries" className="flex-1 text-xs gap-1.5">
                <HelpCircle className="size-3" />
                Mysteries
              </TabsTrigger>
            </TabsList>

            <TabsContent value="standard">
              <AchievementGrid items={achievements.standard} onSelect={setSelectedAch} />
            </TabsContent>

            <TabsContent value="cultural">
              {achievements.cultural.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Globe className="size-10 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1">No cultural badges yet</p>
                    <p className="text-xs text-muted-foreground">Keep practicing to unlock language-specific achievements!</p>
                  </CardContent>
                </Card>
              ) : (
                <AchievementGrid items={achievements.cultural} onSelect={setSelectedAch} />
              )}
            </TabsContent>

            <TabsContent value="mysteries">
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {achievements.easterEggs.map((egg, i) => (
                  <motion.div
                    key={`egg-${i}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.04, duration: 0.3 }}
                  >
                    <Card className="opacity-50 border-dashed overflow-hidden relative group">
                      {/* Animated shimmer */}
                      <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/10 to-transparent"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 3, repeat: Infinity, delay: i * 0.3, ease: "easeInOut" }}
                        />
                      </div>
                      <CardContent className="p-3 flex flex-col items-center justify-center text-center relative">
                        <motion.div
                          animate={{ scale: [1, 1.05, 1], opacity: [0.6, 0.8, 0.6] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                          className="size-10 rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 ring-1 ring-violet-500/20 flex items-center justify-center mb-1.5"
                        >
                          <Lock className="size-4 text-violet-400/60" />
                        </motion.div>
                        <p className="text-[11px] font-bold text-muted-foreground">???</p>
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5">Hidden</p>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-center text-muted-foreground/60 mt-3 italic">
                Some secrets reveal themselves only to the most curious learners...
              </p>
            </TabsContent>
          </Tabs>
        </motion.div>

        {/* Quick Links */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.4 }}>
          <div className="grid grid-cols-3 gap-3">
            <Card className="cursor-pointer group hover:shadow-md hover:border-primary/30 transition-all" onClick={() => router.push("/progress")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary transition-colors">
                  <TrendingUp className="size-4 text-primary group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Progress</p>
                  <p className="text-[10px] text-muted-foreground">Roadmap</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer group hover:shadow-md hover:border-yellow-500/30 transition-all" onClick={() => router.push("/store")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-yellow-500/10 flex items-center justify-center group-hover:bg-yellow-500 transition-colors">
                  <ShoppingBag className="size-4 text-yellow-500 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Store</p>
                  <p className="text-[10px] text-muted-foreground">Boosts</p>
                </div>
              </CardContent>
            </Card>
            <Card className="cursor-pointer group hover:shadow-md hover:border-amber-500/30 transition-all" onClick={() => router.push("/settings")}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="size-10 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500 transition-colors">
                  <Settings className="size-4 text-amber-500 group-hover:text-white transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Settings</p>
                  <p className="text-[10px] text-muted-foreground">Prefs</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Achievement Detail Modal */}
        <AchievementModal
          ach={selectedAch}
          stats={stats}
          masteries={data?.masteries || []}
          targetLang={targetLang}
          open={!!selectedAch}
          onClose={() => setSelectedAch(null)}
        />

        {/* Pin Achievements Dialog */}
        <Dialog open={showPinDialog} onOpenChange={setShowPinDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Pencil className="size-4 text-primary" />
                </div>
                Pin Achievements
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground -mt-1">
              Pick up to 3 earned achievements to showcase on your profile card instead of the default stats.
            </p>
            {achievements.earnedBadges.length === 0 ? (
              <div className="py-8 text-center">
                <Trophy className="size-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm font-medium">No achievements earned yet</p>
                <p className="text-xs text-muted-foreground mt-1">Keep practicing to unlock badges!</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-0.5">
                {achievements.earnedBadges.map((ach) => {
                  const isPinned = pinnedAchIds.includes(ach.id);
                  const isDisabled = !isPinned && pinnedAchIds.length >= 3;
                  const PAchIcon = ach.icon;
                  const badge = tierBadge[ach.tier];
                  return (
                    <button
                      key={ach.id}
                      onClick={() => {
                        if (isPinned) {
                          setPinnedAchIds((prev) => prev.filter((id) => id !== ach.id));
                        } else if (!isDisabled) {
                          setPinnedAchIds((prev) => [...prev, ach.id]);
                        }
                      }}
                      disabled={isDisabled}
                      className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                        isPinned
                          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                          : isDisabled
                            ? "border-border/20 opacity-35 cursor-not-allowed"
                            : "border-border/40 hover:border-primary/30 hover:bg-muted/30"
                      }`}
                    >
                      <div className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${badge.bg}`}>
                        <PAchIcon className={`size-4 ${badge.text}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate">{ach.label}</p>
                        <span className={`text-[8px] font-black px-1 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                          {badge.label}
                        </span>
                      </div>
                      {isPinned && <Check className="size-4 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {pinnedAchIds.length}/3 pinned
                {pinnedAchIds.length > 0 && (
                  <button
                    onClick={() => setPinnedAchIds([])}
                    className="ml-2 text-muted-foreground/60 hover:text-destructive transition-colors underline-offset-2 hover:underline text-[10px]"
                  >
                    Clear all
                  </button>
                )}
              </span>
              <Button size="sm" onClick={() => setShowPinDialog(false)}>Done</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
