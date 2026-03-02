import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion } from "motion/react";
import Link from "next/link";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cefrLabel } from "@/lib/utils";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import { getCurriculumForLevel, getConceptName } from "@/curriculum";
import { CEFRLevel } from "@/generated/prisma/enums";
import ReactCountryFlag from "react-country-flag";
import {
  Flame,
  MessageCircle,
  BookOpen,
  Trophy,
  ArrowRight,
  ChevronRight,
  Zap,
  Target,
  Sparkles,
  Star,
  Award,
  Clock,
  TrendingUp,
  Brain,
  Mic,
  CheckCircle2,
  Circle,
  GraduationCap,
  Volume2,
  PenLine,
  Headphones,
  Timer,
  Lock,
  Eye,
} from "lucide-react";

interface DashboardData {
  profile: any;
  stats: {
    totalSessions: number;
    totalMessages: number;
    currentStreak: number;
    conceptsMastered: number;
    totalConceptsInLevel: number;
    levelProgress: number;
  };
  recentSessions: any[];
  masteries: any[];
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "In progress";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "<1 min";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-36 rounded-2xl" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-2xl" />
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  );
}

function getGreeting(lang: string) {
  const hour = new Date().getHours();
  const greetings: Record<string, [string, string, string]> = {
    fr: ["Bonjour", "Bon apr\u00e8s-midi", "Bonsoir"],
    es: ["Buenos d\u00edas", "Buenas tardes", "Buenas noches"],
    de: ["Guten Morgen", "Guten Tag", "Guten Abend"],
  };
  const g = greetings[lang] || greetings.fr;
  if (hour < 12) return g[0];
  if (hour < 18) return g[1];
  return g[2];
}

function getMotivation(
  stats: DashboardData["stats"] | undefined,
  tutorName: string
) {
  if (!stats) return `${tutorName} is ready when you are.`;

  const hour = new Date().getHours();
  const streak = stats.currentStreak || 0;
  const sessions = stats.totalSessions || 0;
  const progress = stats.levelProgress || 0;

  // Witty rotating messages based on streak/time/activity
  const wittyMessages: string[] = [];

  // Streak-based
  if (streak >= 14) {
    wittyMessages.push(
      `${streak} days straight? At this rate, you'll be writing poetry by Tuesday.`,
      `${streak}-day streak. Even ${tutorName} is impressed — and they've seen a lot.`,
    );
  } else if (streak >= 7) {
    wittyMessages.push(
      `A week straight — your brain is thanking you in multiple languages.`,
      `7+ days strong. Consistency > perfection, and you've got both.`,
      `${tutorName} says you're on fire. The streak speaks for itself.`,
    );
  } else if (streak >= 3) {
    wittyMessages.push(
      `${streak} days running — the hardest part is already behind you.`,
      `Streak mode: activated. ${tutorName} has fresh material ready.`,
    );
  } else if (streak === 0 && sessions > 0) {
    wittyMessages.push(
      `Your streak took a nap. Let's wake it up — ${tutorName} misses you.`,
      `A fresh start. Every polyglot has restart moments.`,
    );
  }

  // Time-based
  if (hour < 9) {
    wittyMessages.push(
      `Early riser, early learner. The brain absorbs best in the morning.`,
      `Before coffee, before email — just you and a new language. Respect.`,
    );
  } else if (hour >= 22) {
    wittyMessages.push(
      `Night owl learning? Studies say sleep cements new vocab. Double win.`,
      `Late-night languages hit different. Let's make it count.`,
    );
  }

  // Progress-based
  if (progress >= 80) {
    wittyMessages.push(
      `${progress}% through this level — the finish line is in sight!`,
      `Almost there. A few more concepts and you level up.`,
    );
  } else if (progress >= 40) {
    wittyMessages.push(`Halfway there and building real momentum. Keep pushing.`);
  } else if (sessions === 0) {
    wittyMessages.push(
      `Your learning journey begins now. ${tutorName} is ready to guide you.`,
      `First session jitters? Don't worry — ${tutorName} goes at your pace.`,
    );
  }

  // General witty fallbacks
  wittyMessages.push(
    `Every session is a small investment with compounding returns.`,
    `${tutorName} prepared something interesting for you today.`,
    `Small steps, big fluency. Let's add another brick today.`,
  );

  // Pick a pseudo-random message from the available pool, stable within the hour
  const dayIndex = new Date().getDate() + hour;
  return wittyMessages[dayIndex % wittyMessages.length];
}

function getAchievements(stats: DashboardData["stats"] | undefined, masteries: any[] = []) {
  if (!stats) return [];

  const grammarMastered = masteries.filter((m) => m.conceptType === "GRAMMAR" && m.masteryScore >= 0.7).length;
  const vocabMastered = masteries.filter((m) => m.conceptType === "VOCABULARY" && m.masteryScore >= 0.7).length;
  const avgMastery = masteries.length > 0
    ? masteries.reduce((sum: number, m: any) => sum + m.masteryScore, 0) / masteries.length
    : 0;

  type Achievement = {
    label: string;
    icon: any;
    earned: boolean;
    desc: string;
    progress: number;
    tier: "bronze" | "silver" | "gold" | "diamond";
  };

  const all: Achievement[] = [
    // Session milestones — 4 tiers
    { label: "First Steps", icon: Star, earned: stats.totalSessions >= 1, desc: "Complete your first session", progress: Math.min(100, (stats.totalSessions / 1) * 100), tier: "bronze" },
    { label: "Dedicated", icon: Award, earned: stats.totalSessions >= 10, desc: "Complete 10 sessions", progress: Math.min(100, (stats.totalSessions / 10) * 100), tier: "silver" },
    { label: "Veteran", icon: GraduationCap, earned: stats.totalSessions >= 25, desc: "Complete 25 sessions", progress: Math.min(100, (stats.totalSessions / 25) * 100), tier: "gold" },
    { label: "Linguist", icon: Trophy, earned: stats.totalSessions >= 50, desc: "Complete 50 sessions", progress: Math.min(100, (stats.totalSessions / 50) * 100), tier: "diamond" },
    // Streak milestones — 4 tiers
    { label: "On Fire", icon: Flame, earned: stats.currentStreak >= 3, desc: "3-day practice streak", progress: Math.min(100, (stats.currentStreak / 3) * 100), tier: "bronze" },
    { label: "Unstoppable", icon: Zap, earned: stats.currentStreak >= 7, desc: "7-day practice streak", progress: Math.min(100, (stats.currentStreak / 7) * 100), tier: "silver" },
    { label: "Relentless", icon: Flame, earned: stats.currentStreak >= 14, desc: "14-day practice streak", progress: Math.min(100, (stats.currentStreak / 14) * 100), tier: "gold" },
    { label: "Unbreakable", icon: Flame, earned: stats.currentStreak >= 30, desc: "30-day practice streak", progress: Math.min(100, (stats.currentStreak / 30) * 100), tier: "diamond" },
    // Mastery milestones
    { label: "Grammar Starter", icon: Brain, earned: grammarMastered >= 3, desc: "Master 3 grammar concepts", progress: Math.min(100, (grammarMastered / 3) * 100), tier: "bronze" },
    { label: "Word Collector", icon: BookOpen, earned: vocabMastered >= 3, desc: "Master 3 vocabulary groups", progress: Math.min(100, (vocabMastered / 3) * 100), tier: "bronze" },
    { label: "Scholar", icon: Brain, earned: stats.conceptsMastered >= 10, desc: "Master 10 concepts total", progress: Math.min(100, (stats.conceptsMastered / 10) * 100), tier: "silver" },
    { label: "Polymath", icon: Brain, earned: stats.conceptsMastered >= 20, desc: "Master 20 concepts total", progress: Math.min(100, (stats.conceptsMastered / 20) * 100), tier: "gold" },
    // Communication milestones — 4 tiers
    { label: "Talkative", icon: MessageCircle, earned: stats.totalMessages >= 50, desc: "Send 50 messages", progress: Math.min(100, (stats.totalMessages / 50) * 100), tier: "bronze" },
    { label: "Chatterbox", icon: MessageCircle, earned: stats.totalMessages >= 200, desc: "Send 200 messages", progress: Math.min(100, (stats.totalMessages / 200) * 100), tier: "silver" },
    { label: "Eloquent", icon: MessageCircle, earned: stats.totalMessages >= 500, desc: "Send 500 messages", progress: Math.min(100, (stats.totalMessages / 500) * 100), tier: "gold" },
    { label: "Orator", icon: MessageCircle, earned: stats.totalMessages >= 1000, desc: "Send 1000 messages", progress: Math.min(100, (stats.totalMessages / 1000) * 100), tier: "diamond" },
    // Overall mastery
    { label: "High Achiever", icon: Trophy, earned: avgMastery >= 0.6, desc: "Average mastery above 60%", progress: Math.min(100, (avgMastery / 0.6) * 100), tier: "gold" },
    { label: "Level Up", icon: TrendingUp, earned: stats.levelProgress >= 60, desc: "Reach 60% level progress", progress: Math.min(100, (stats.levelProgress / 60) * 100), tier: "gold" },
  ];

  const earned = all.filter((a) => a.earned);
  const inProgress = all.filter((a) => !a.earned && a.progress > 0).sort((a, b) => b.progress - a.progress);
  const locked = all.filter((a) => !a.earned && a.progress === 0);
  return [...earned, ...inProgress, ...locked];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const targetLang = session?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) fetchDashboard();
  }, [session]);

  // Get curriculum for current level to show next topics (must be above early returns)
  const curriculum = useMemo(() => {
    if (!data?.profile?.currentLevel) return null;
    try {
      return getCurriculumForLevel(data.profile.currentLevel as CEFRLevel, targetLang);
    } catch {
      return null;
    }
  }, [data?.profile?.currentLevel, targetLang]);

  // Find concepts not yet mastered for "Up Next" display
  const upNextConcepts = useMemo(() => {
    if (!curriculum || !data?.masteries) return [];
    const masteryMap = new Map(data.masteries.map((m: any) => [m.conceptId, m.masteryScore]));
    const unmastered = curriculum.conceptIds.filter((id) => {
      const score = masteryMap.get(id);
      return !score || score < 0.7;
    });
    return unmastered.slice(0, 6);
  }, [curriculum, data?.masteries]);

  async function fetchDashboard() {
    try {
      const res = await fetch("/api/progress");
      if (res.ok) setData(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="Dashboard" />
        <DashboardSkeleton />
      </Layout>
    );
  }

  if (!session) return null;

  if (!loading && data && !data.profile) {
    router.push("/onboarding");
    return null;
  }

  const stats = data?.stats;
  const profile = data?.profile;
  const streakDays = stats?.currentStreak || 0;
  const achievements = getAchievements(stats, data?.masteries || []);

  const grammarConcepts =
    data?.masteries?.filter((m: any) => m.conceptType === "GRAMMAR") || [];
  const vocabConcepts =
    data?.masteries?.filter((m: any) => m.conceptType === "VOCABULARY") || [];
  const totalConcepts = data?.masteries?.length || 0;

  return (
    <Layout>
      <SEO title="Dashboard" />
      <div className="space-y-5">
        {/* Hero Welcome Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <Card className="overflow-hidden border-0 shadow-2xl shadow-violet-500/10 dark:shadow-violet-500/5">
            <div className="relative bg-gradient-to-br from-violet-600/15 via-primary/10 to-blue-600/10 dark:from-violet-600/20 dark:via-primary/12 dark:to-blue-600/8">
              {/* Decorative orbs */}
              <div className="absolute top-0 right-0 size-56 bg-violet-500/12 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3" />
              <div className="absolute bottom-0 left-0 size-40 bg-blue-500/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
              <div className="absolute top-1/2 left-1/2 size-32 bg-primary/6 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />

              <CardContent className="relative p-5 sm:p-7">
                {/* Top row: Greeting + CEFR Badge */}
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <ReactCountryFlag
                        countryCode={tutor.countryCode}
                        svg
                        style={{ width: "1.25rem", height: "1.25rem" }}
                        className="rounded-sm"
                      />
                      <span className="text-sm font-semibold text-violet-600 dark:text-violet-400">
                        {getGreeting(targetLang)}
                      </span>
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-black tracking-tight mb-1.5">
                      {session.user?.name?.split(" ")[0] || "there"}
                    </h1>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
                      {getMotivation(stats, tutor.name)}
                    </p>
                  </div>

                  {/* CEFR Level Badge — large and proud */}
                  <div className="flex flex-col items-center gap-1.5 shrink-0">
                    <div className="relative">
                      <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-xl scale-125" />
                      <div className="relative size-20 sm:size-24 rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 dark:from-violet-500 dark:to-violet-600 flex flex-col items-center justify-center shadow-xl shadow-violet-500/30 ring-2 ring-violet-400/30">
                        <span className="text-2xl sm:text-3xl font-black text-white leading-none">
                          {profile?.currentLevel || "A0"}
                        </span>
                        <span className="text-[10px] sm:text-xs text-violet-200 font-semibold mt-0.5 uppercase tracking-wider">
                          CEFR
                        </span>
                      </div>
                    </div>
                    {profile?.currentLevel && (
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {cefrLabel(profile.currentLevel)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Skill Breakdown — Reading & Writing tracked, Speaking & Listening voice-only */}
                {profile && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4">
                    {[
                      { label: "Reading", icon: Eye, score: profile.comprehensionScore ?? 0, color: "text-green-500", bg: "bg-green-500", track: "bg-green-500/15", active: true },
                      { label: "Writing", icon: PenLine, score: profile.grammarScore ?? 0, color: "text-indigo-500", bg: "bg-indigo-500", track: "bg-indigo-500/15", active: true },
                      { label: "Speaking", icon: Mic, score: null, color: "text-rose-500", bg: "bg-rose-500", track: "bg-rose-500/15", active: false },
                      { label: "Listening", icon: Headphones, score: null, color: "text-cyan-500", bg: "bg-cyan-500", track: "bg-cyan-500/15", active: false },
                    ].map((skill) => {
                      const Icon = skill.icon;
                      const pct = skill.active && skill.score !== null ? Math.round(skill.score * 100) : 0;
                      return (
                        <div key={skill.label} className={`bg-background/60 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-white/10 dark:border-white/5 ${!skill.active ? "opacity-60" : ""}`}>
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Icon className={`size-3.5 ${skill.color}`} />
                            <span className="text-[10px] sm:text-xs font-semibold truncate">{skill.label}</span>
                            {!skill.active && <Lock className="size-2.5 text-muted-foreground ml-auto" />}
                          </div>
                          {skill.active ? (
                            <>
                              <div className={`h-1.5 rounded-full ${skill.track} overflow-hidden`}>
                                <motion.div
                                  className={`h-full rounded-full ${skill.bg}`}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${pct}%` }}
                                  transition={{ delay: 0.6, duration: 0.7, ease: "easeOut" }}
                                />
                              </div>
                              <span className={`text-[10px] font-bold ${skill.color} mt-1 block`}>
                                {pct > 0 ? `${pct}%` : "Start practicing"}
                              </span>
                            </>
                          ) : (
                            <div className="flex items-center gap-1 mt-1">
                              <Mic className="size-2.5 text-muted-foreground" />
                              <span className="text-[9px] text-muted-foreground">Available in Voice Mode</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Level Progress Bar */}
                {stats && stats.levelProgress > 0 && (
                  <div className="pt-3 border-t border-white/10 dark:border-white/5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground font-medium">
                        Progress to next level
                      </span>
                      <span className="font-bold text-violet-600 dark:text-violet-400">
                        {stats.levelProgress}%
                      </span>
                    </div>
                    <div className="relative h-2.5 bg-violet-500/10 rounded-full overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-blue-500 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.levelProgress}%` }}
                        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* Start Practice CTA */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
        >
          <Card
            className="cursor-pointer group overflow-hidden border-violet-500/30 hover:border-violet-500/50 hover:shadow-2xl hover:shadow-violet-500/15 transition-all duration-300"
            onClick={() => router.push("/practice")}
          >
            <div className="bg-gradient-to-r from-violet-600/15 via-fuchsia-500/8 to-blue-500/10">
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-center gap-4">
                  {/* Tutor Avatar */}
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-violet-500/20 rounded-2xl blur-lg scale-125" />
                    <div className="relative size-16 sm:size-18 rounded-2xl bg-gradient-to-br from-violet-500 via-violet-600 to-fuchsia-600 flex items-center justify-center shadow-xl shadow-violet-500/30 group-hover:shadow-violet-500/50 transition-all group-hover:scale-105 ring-2 ring-violet-400/20">
                      <span className="text-2xl sm:text-3xl font-black text-white">{tutor.name.charAt(0)}</span>
                    </div>
                    <ReactCountryFlag
                      countryCode={tutor.countryCode}
                      svg
                      style={{ width: "1.1rem", height: "1.1rem" }}
                      className="absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-background"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg sm:text-xl font-black group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                      Continue with {tutor.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                      {streakDays === 0 && stats && stats.totalSessions > 0
                        ? "Practice now to restart your streak!"
                        : upNextConcepts.length > 0
                          ? `Next up: ${getConceptName(upNextConcepts[0], targetLang)}`
                          : `Your ${tutor.language} tutor is ready`}
                    </p>
                    {streakDays === 0 && stats && stats.totalSessions > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-orange-500 font-bold mt-1 animate-pulse">
                        <Flame className="size-3" /> Streak lost — practice now!
                      </span>
                    )}
                    {upNextConcepts.length > 0 && !(streakDays === 0 && stats && stats.totalSessions > 0) && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        {upNextConcepts.slice(0, 2).map((id) => {
                          const isGrammar = id.startsWith("grammar.");
                          return (
                            <span key={id} className={`inline-flex items-center gap-1 text-[10px] font-medium rounded-full px-2 py-0.5 ${
                              isGrammar
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            }`}>
                              {isGrammar ? <Brain className="size-2.5" /> : <BookOpen className="size-2.5" />}
                              <span className="capitalize">{getConceptName(id, targetLang)}</span>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className="size-12 rounded-xl bg-gradient-to-br from-violet-500/15 to-fuchsia-500/10 flex items-center justify-center group-hover:bg-gradient-to-br group-hover:from-violet-500 group-hover:to-fuchsia-500 group-hover:text-white transition-all shrink-0 ring-1 ring-violet-500/15 group-hover:ring-violet-500/40">
                    <ArrowRight className="size-5" />
                  </div>
                </div>
              </CardContent>
            </div>
          </Card>
        </motion.div>

        {/* What You're Learning — enriched with real concept names */}
        {totalConcepts > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <TrendingUp className="size-4 text-primary" />
                What You&apos;re Learning
              </h2>
              <Link
                href="/progress"
                className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-0.5"
              >
                See all <ChevronRight className="size-3" />
              </Link>
            </div>

            {/* Grammar & Vocab breakdown with concept names */}
            <div className="space-y-2.5">
              {grammarConcepts.length > 0 && (
                <Card>
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Brain className="size-3.5 text-amber-500" />
                      </div>
                      <span className="text-sm font-semibold">Grammar</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                        {grammarConcepts.filter((c: any) => c.masteryScore >= 0.7).length}/{grammarConcepts.length}
                      </Badge>
                    </div>
                    <div className="grid gap-1.5">
                      {grammarConcepts.slice(0, 4).map((c: any) => {
                        const pct = Math.round(c.masteryScore * 100);
                        const name = getConceptName(c.conceptId, targetLang);
                        return (
                          <div key={c.conceptId} className="flex items-center gap-2">
                            <div className={`size-5 rounded flex items-center justify-center shrink-0 ${
                              pct >= 70 ? "bg-emerald-500/15" : "bg-muted/50"
                            }`}>
                              {pct >= 70 ? (
                                <CheckCircle2 className="size-3 text-emerald-500" />
                              ) : (
                                <Circle className="size-3 text-muted-foreground/50" />
                              )}
                            </div>
                            <span className="text-xs flex-1 capitalize truncate">{name}</span>
                            <div className="w-16">
                              <Progress value={pct} className="h-1.5" />
                            </div>
                            <span className={`text-[10px] font-medium w-8 text-right ${
                              pct >= 70 ? "text-emerald-500" : "text-muted-foreground"
                            }`}>{pct}%</span>
                          </div>
                        );
                      })}
                      {grammarConcepts.length > 4 && (
                        <Link href="/progress" className="text-[11px] text-muted-foreground hover:text-primary text-center mt-1">
                          +{grammarConcepts.length - 4} more grammar concepts
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {vocabConcepts.length > 0 && (
                <Card>
                  <CardContent className="p-3.5">
                    <div className="flex items-center gap-2 mb-2.5">
                      <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <BookOpen className="size-3.5 text-blue-500" />
                      </div>
                      <span className="text-sm font-semibold">Vocabulary</span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 ml-auto">
                        {vocabConcepts.filter((c: any) => c.masteryScore >= 0.7).length}/{vocabConcepts.length}
                      </Badge>
                    </div>
                    <div className="grid gap-1.5">
                      {vocabConcepts.slice(0, 4).map((c: any) => {
                        const pct = Math.round(c.masteryScore * 100);
                        const name = getConceptName(c.conceptId, targetLang);
                        return (
                          <div key={c.conceptId} className="flex items-center gap-2">
                            <div className={`size-5 rounded flex items-center justify-center shrink-0 ${
                              pct >= 70 ? "bg-emerald-500/15" : "bg-muted/50"
                            }`}>
                              {pct >= 70 ? (
                                <CheckCircle2 className="size-3 text-emerald-500" />
                              ) : (
                                <Circle className="size-3 text-muted-foreground/50" />
                              )}
                            </div>
                            <span className="text-xs flex-1 capitalize truncate">{name}</span>
                            <div className="w-16">
                              <Progress value={pct} className="h-1.5" />
                            </div>
                            <span className={`text-[10px] font-medium w-8 text-right ${
                              pct >= 70 ? "text-emerald-500" : "text-muted-foreground"
                            }`}>{pct}%</span>
                          </div>
                        );
                      })}
                      {vocabConcepts.length > 4 && (
                        <Link href="/progress" className="text-[11px] text-muted-foreground hover:text-primary text-center mt-1">
                          +{vocabConcepts.length - 4} more vocabulary groups
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <Card>
              <CardContent className="p-5 text-center">
                <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <Brain className="size-5 text-primary" />
                </div>
                <p className="text-sm font-semibold mb-1">Your learning journey starts here</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Complete your first lesson and {tutor.name} will track the grammar and vocabulary you practice.
                </p>
                <Button size="sm" onClick={() => router.push("/practice")} className="gap-1.5">
                  <BookOpen className="size-3.5" />
                  Start a Lesson
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Up Next — curriculum preview */}
        {curriculum && upNextConcepts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.52, duration: 0.4 }}
          >
            <Card className="overflow-hidden border-violet-500/20 shadow-md shadow-violet-500/5">
              <div className="bg-gradient-to-br from-violet-600/12 via-violet-500/8 to-blue-500/6 dark:from-violet-600/18 dark:via-violet-500/10 dark:to-blue-500/6">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2.5 mb-3.5">
                    <div className="size-9 rounded-xl bg-violet-500/15 flex items-center justify-center ring-1 ring-violet-500/20">
                      <GraduationCap className="size-4.5 text-violet-500" />
                    </div>
                    <div>
                      <span className="text-sm font-bold block">Up Next in {curriculum.label}</span>
                      <span className="text-[10px] text-muted-foreground">{tutor.name} will introduce these next</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {upNextConcepts.map((id) => {
                      const isGrammar = id.startsWith("grammar.");
                      const name = id.replace(/^(grammar\.|vocab\.)/, "").replace(/_/g, " ");
                      return (
                        <span
                          key={id}
                          className={`inline-flex items-center gap-1.5 text-[11px] font-medium rounded-lg px-3 py-1.5 border backdrop-blur-sm ${
                            isGrammar
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400"
                              : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                          }`}
                        >
                          {isGrammar ? <Brain className="size-3" /> : <BookOpen className="size-3" />}
                          <span className="capitalize">{name}</span>
                        </span>
                      );
                    })}
                  </div>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        )}

        {/* Achievement Card — Focus on next-to-earn */}
        {achievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.4 }}
          >
            {(() => {
              // Primary: next unearned with highest progress. Fallback: latest earned.
              const nextUp = achievements.find((a) => !a.earned && a.progress > 0);
              const latestEarned = achievements.find((a) => a.earned);
              const featured = nextUp || latestEarned;
              if (!featured) return null;
              const Icon = featured.icon;
              const isNextUp = !!nextUp && featured === nextUp;

              return (
                <Card className={`overflow-hidden border-l-4 shadow-lg relative ${
                  isNextUp
                    ? "border-l-primary border-primary/20 shadow-primary/8"
                    : "border-l-amber-400 border-amber-500/20 shadow-amber-500/8"
                }`}>
                  {/* Celebratory confetti for earned only */}
                  {!isNextUp && (
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      {[...Array(8)].map((_, i) => (
                        <motion.div
                          key={`confetti-${i}`}
                          initial={{ opacity: 0, y: -10, x: 0, scale: 0 }}
                          animate={{
                            opacity: [0, 1, 1, 0],
                            y: [-10, -30 - i * 8, 10],
                            x: [(i % 2 ? 1 : -1) * (10 + i * 12)],
                            scale: [0, 1, 0.6],
                            rotate: [0, (i % 2 ? 1 : -1) * 180],
                          }}
                          transition={{ duration: 1.5, delay: 0.3 + i * 0.08, ease: "easeOut" }}
                          className="absolute"
                          style={{
                            left: `${35 + i * 5}%`,
                            top: "50%",
                            width: 6,
                            height: 6,
                            borderRadius: i % 3 === 0 ? "50%" : "1px",
                            background: ["#fbbf24", "#f59e0b", "#eab308", "#fcd34d", "#d97706", "#facc15", "#fb923c", "#f97316"][i],
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <div className={`h-0.5 bg-gradient-to-r ${
                    isNextUp ? "from-primary via-violet-400 to-primary" : "from-yellow-400 via-amber-300 to-yellow-500"
                  }`} />
                  <div className={`bg-gradient-to-r ${
                    isNextUp ? "from-primary/8 via-violet-500/5 to-transparent" : "from-amber-500/8 via-yellow-500/5 to-transparent"
                  }`}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex items-center gap-3.5">
                        <div className="relative shrink-0">
                          <div className={`absolute inset-0 rounded-xl blur-md scale-125 ${
                            isNextUp ? "bg-primary/20" : "bg-amber-400/20"
                          }`} />
                          <div className={`relative size-13 rounded-xl flex items-center justify-center shadow-lg ring-2 ${
                            isNextUp
                              ? "bg-gradient-to-br from-primary to-violet-500 shadow-primary/25 ring-primary/20"
                              : "bg-gradient-to-br from-amber-400 to-yellow-500 shadow-amber-500/25 ring-amber-400/20"
                          }`}>
                            <Icon className="size-6 text-white drop-shadow" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="text-base font-black">{featured.label}</p>
                            {isNextUp ? (
                              <Badge className="bg-primary/15 text-primary border-primary/25 text-[10px] px-2 py-0.5 font-bold">
                                <Target className="size-2.5 mr-0.5" />
                                Up Next
                              </Badge>
                            ) : (
                              <Badge className="bg-gradient-to-r from-amber-400/20 to-yellow-500/15 text-amber-600 dark:text-amber-400 border-amber-400/30 text-[10px] px-2 py-0.5 font-black shadow-sm">
                                <Trophy className="size-2.5 mr-0.5" />
                                Earned!
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{featured.desc}</p>
                        </div>
                        <Link
                          href="/profile"
                          className="text-xs text-primary hover:underline shrink-0 flex items-center gap-0.5 font-medium"
                        >
                          All <ChevronRight className="size-3" />
                        </Link>
                      </div>
                      {isNextUp && (
                        <div className="mt-3 pt-2.5 border-t border-primary/10">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span className="flex items-center gap-1">
                              <Star className="size-3 text-primary" />
                              {Math.round(featured.progress)}% complete
                            </span>
                            <span className="font-bold text-primary">{Math.round(featured.progress)}%</span>
                          </div>
                          <Progress value={featured.progress} className="h-1.5" />
                        </div>
                      )}
                      {!isNextUp && nextUp && (
                        <div className="mt-3 pt-2.5 border-t border-amber-500/10">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span className="flex items-center gap-1">
                              <Star className="size-3 text-amber-400" />
                              Next: {nextUp.label} — {nextUp.desc}
                            </span>
                            <span className="font-bold text-amber-500">{Math.round(nextUp.progress)}%</span>
                          </div>
                          <Progress value={nextUp.progress} className="h-1.5" />
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>
              );
            })()}
          </motion.div>
        )}

        {/* Recent Sessions */}
        {data?.recentSessions && data.recentSessions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.4 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold flex items-center gap-2">
                <div className="size-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="size-3.5 text-primary" />
                </div>
                Recent Activity
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7"
                onClick={() => router.push("/history")}
              >
                View all
                <ChevronRight className="size-3 ml-0.5" />
              </Button>
            </div>
            <div className="space-y-3">
              {data.recentSessions.slice(0, 3).map((s: any, i: number) => {
                const typeConfig: Record<string, { label: string; icon: any; color: string; bg: string; accent: string; border: string }> = {
                  LESSON: { label: "Lesson", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10", accent: "bg-blue-500", border: "border-l-blue-500" },
                  FREE_CONVERSATION: { label: "Conversation", icon: MessageCircle, color: "text-emerald-500", bg: "bg-emerald-500/10", accent: "bg-emerald-500", border: "border-l-emerald-500" },
                  REVIEW: { label: "Review", icon: Target, color: "text-amber-500", bg: "bg-amber-500/10", accent: "bg-amber-500", border: "border-l-amber-500" },
                  PLACEMENT: { label: "Placement", icon: GraduationCap, color: "text-violet-500", bg: "bg-violet-500/10", accent: "bg-violet-500", border: "border-l-violet-500" },
                  READING: { label: "Reading", icon: Eye, color: "text-green-500", bg: "bg-green-500/10", accent: "bg-green-500", border: "border-l-green-500" },
                  WRITING: { label: "Writing", icon: PenLine, color: "text-indigo-500", bg: "bg-indigo-500/10", accent: "bg-indigo-500", border: "border-l-indigo-500" },
                };
                const cfg = typeConfig[s.sessionType] || typeConfig.LESSON;
                const TypeIcon = cfg.icon;
                const sessionTypeLabel = cfg.label;
                const duration = formatDuration(s.startedAt, s.endedAt);
                const concepts = s.focusConcepts || [];
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.75 + i * 0.04, duration: 0.3 }}
                  >
                    <Card
                      className={`hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 cursor-pointer group overflow-hidden border-l-3 ${cfg.border}`}
                      onClick={() =>
                        s.endedAt
                          ? router.push(`/history/${s.id}`)
                          : router.push(`/practice?session=${s.id}`)
                      }
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`size-11 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5`}>
                            <TypeIcon className={`size-5 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-black">
                                Session #{s.sessionNumber}
                              </p>
                              <Badge
                                className={`text-[9px] px-2 py-0 h-[18px] ${cfg.bg} ${cfg.color} border-0 font-bold`}
                              >
                                {sessionTypeLabel}
                              </Badge>
                              {s.cefrLevel && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-[18px] font-bold">
                                  {s.cefrLevel}
                                </Badge>
                              )}
                              {!s.endedAt && (
                                <Badge className="text-[9px] px-1.5 py-0 h-[18px] bg-primary/15 text-primary border-0 animate-pulse font-bold">
                                  Active
                                </Badge>
                              )}
                            </div>
                            {/* Journal-style meta row */}
                            <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5">
                              <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5">
                                <MessageCircle className="size-2.5" />
                                {s.messageCount} msgs
                              </span>
                              <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5">
                                <Timer className="size-2.5" />
                                {duration}
                              </span>
                              <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5">
                                <Clock className="size-2.5" />
                                {new Date(s.startedAt).toLocaleDateString()}
                              </span>
                            </div>
                            {/* Concept tags */}
                            {concepts.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {concepts.slice(0, 3).map((c: string) => (
                                  <Badge
                                    key={c}
                                    variant="secondary"
                                    className="text-[9px] px-2 py-0.5 h-5 capitalize gap-1 font-medium"
                                  >
                                    <Brain className="size-2.5" />
                                    {getConceptName(c, targetLang)}
                                  </Badge>
                                ))}
                                {concepts.length > 3 && (
                                  <Badge variant="secondary" className="text-[9px] px-2 py-0.5 h-5 font-medium">
                                    +{concepts.length - 3}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {s.summary?.topicsCovered && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-3 leading-relaxed bg-muted/20 rounded-lg p-2 border border-border/30">
                                <Sparkles className="size-3 inline mr-1 text-violet-400 align-text-bottom" />
                                {s.summary.topicsCovered}
                              </p>
                            )}
                            {!s.summary?.topicsCovered && !concepts.length && s.endedAt && (
                              <p className="text-[11px] text-muted-foreground/50 mt-1.5 italic">
                                No summary available
                              </p>
                            )}
                          </div>
                          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Witty empty state when no sessions yet */}
        {(!data?.recentSessions || data.recentSessions.length === 0) && stats && stats.totalSessions === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <Card className="border-dashed">
              <CardContent className="p-6 text-center">
                <motion.div
                  animate={{ rotate: [0, -5, 5, -5, 0] }}
                  transition={{ duration: 1.5, delay: 1, repeat: Infinity, repeatDelay: 4 }}
                  className="inline-block mb-3"
                >
                  <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                    <MessageCircle className="size-6 text-primary" />
                  </div>
                </motion.div>
                <p className="text-sm font-bold mb-1">
                  {tutor.name} is warming up the conversation...
                </p>
                <p className="text-xs text-muted-foreground">
                  {targetLang === "fr"
                    ? "Start your first session and Amélie will have a croissant ready! 🥐"
                    : targetLang === "es"
                      ? "Sofía is already preparing the perfect tapas conversation opener! 🌮"
                      : "Hans has organized your first lesson with typical German precision! 🍺"}
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
