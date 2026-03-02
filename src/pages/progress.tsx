import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { cefrLabel, CEFR_ORDER } from "@/lib/utils";
import { getCurriculumForLevel, getConceptName } from "@/curriculum";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import { CEFRLevel } from "@/generated/prisma/enums";
import ReactCountryFlag from "react-country-flag";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Brain,
  BookOpen,
  MessageCircle,
  Sparkles,
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Circle,
  Lock,
  Trophy,
  Flame,
  Zap,
  Target,
  ChevronDown,
  ChevronUp,
  Mic,
  PenTool,
  Headphones,
  Eye,
  GraduationCap,
  Languages,
  Bookmark,
} from "lucide-react";

interface ProgressData {
  profile: {
    currentLevel: string;
    comprehensionScore: number;
    vocabularyScore: number;
    grammarScore: number;
    fluencyScore: number;
    overallConfidence: number;
  } | null;
  masteries: {
    conceptId: string;
    conceptType: string;
    masteryScore: number;
    practiceCount: number;
    lastPracticed: string | null;
  }[];
  recentSessions: any[];
  stats: {
    totalSessions: number;
    totalMessages: number;
    currentStreak: number;
    conceptsMastered: number;
    totalConceptsInLevel: number;
    levelProgress: number;
  };
}

interface SavedConcept {
  conceptId: string;
  conceptName: string;
  conceptType: string;
  context: string | null;
  createdAt: string;
  updatedAt: string;
}

function RoadmapNode({
  level,
  label,
  isCurrent,
  isCompleted,
  isLocked,
  isExpanded,
  onToggle,
  curriculum,
  masteryMap,
  savedConceptIds,
  onToggleSave,
  delay,
}: {
  level: string;
  label: string;
  isCurrent: boolean;
  isCompleted: boolean;
  isLocked: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  curriculum: ReturnType<typeof getCurriculumForLevel> | null;
  masteryMap: Map<string, { score: number; count: number }>;
  savedConceptIds: Set<string>;
  onToggleSave: (
    conceptId: string,
    conceptName: string,
    conceptType: string,
    context?: string
  ) => void;
  delay: number;
}) {
  const grammarCount = curriculum?.grammarConcepts.length || 0;
  const vocabCount = curriculum?.vocabularyClusters.length || 0;
  const speakingCount = curriculum?.speakingTasks.length || 0;
  const listeningCount = curriculum?.listeningTasks.length || 0;
  const readingCount = curriculum?.readingTasks.length || 0;
  const writingCount = curriculum?.writingTasks.length || 0;

  // For completed levels (below current), treat all concepts as mastered
  const getMasteryPct = (conceptId: string): number => {
    if (isCompleted) return 100;
    const m = masteryMap.get(conceptId);
    return m ? Math.round(m.score * 100) : 0;
  };

  const masteredInLevel = isCompleted
    ? (curriculum?.conceptIds.length || 0)
    : (curriculum?.conceptIds.filter((id) => {
        const m = masteryMap.get(id);
        return m && m.score >= 0.7;
      }).length || 0);
  const totalInLevel = curriculum?.conceptIds.length || 0;
  const levelPct = totalInLevel > 0 ? Math.round((masteredInLevel / totalInLevel) * 100) : 0;
  const sortedGrammarConcepts = [...(curriculum?.grammarConcepts ?? [])].sort((a, b) => {
    const scoreDiff = getMasteryPct(b.conceptId) - getMasteryPct(a.conceptId);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });
  const sortedVocabularyConcepts = [...(curriculum?.vocabularyClusters ?? [])].sort((a, b) => {
    const scoreDiff = getMasteryPct(b.conceptId) - getMasteryPct(a.conceptId);
    if (scoreDiff !== 0) return scoreDiff;
    return a.name.localeCompare(b.name);
  });

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.3 }}
    >
      <div
        className={`rounded-xl border transition-all cursor-pointer ${
          isCurrent
            ? "border-primary/40 bg-primary/5 shadow-sm shadow-primary/10"
            : isCompleted
              ? "border-emerald-500/20 bg-emerald-500/5"
              : isLocked
                ? "border-muted/30 opacity-60"
                : "border-border hover:border-primary/20"
        }`}
        onClick={!isLocked ? onToggle : undefined}
      >
        <div className="flex items-center gap-3 p-3 sm:p-4">
          <div
            className={`size-10 sm:size-12 rounded-full flex items-center justify-center border-2 transition-all shrink-0 ${
              isCurrent
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30"
                : isCompleted
                  ? "bg-emerald-500 text-white border-emerald-500"
                  : "bg-muted/50 text-muted-foreground border-muted"
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="size-5" />
            ) : isLocked ? (
              <Lock className="size-4" />
            ) : (
              <span className="text-xs font-bold">{level}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${isCurrent ? "text-primary" : ""}`}>
                {level} — {label}
              </p>
              {isCurrent && (
                <Badge className="bg-primary/15 text-primary border-primary/20 text-[10px] px-1.5 py-0">
                  Current
                </Badge>
              )}
              {isCompleted && (
                <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/20 text-[10px] px-1.5 py-0">
                  Done
                </Badge>
              )}
            </div>
            {curriculum && !isLocked && (
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                {curriculum.description}
              </p>
            )}
            {isLocked && (
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Complete {CEFR_ORDER[CEFR_ORDER.indexOf(level as CEFRLevel) - 1] || "previous"} to unlock
              </p>
            )}
            {/* Mini stat pills */}
            {curriculum && !isLocked && (
              <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <Brain className="size-2.5" /> {grammarCount} grammar
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <BookOpen className="size-2.5" /> {vocabCount} vocab groups
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <Eye className="size-2.5" /> {readingCount} reading
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 rounded-full px-2 py-0.5">
                  <PenTool className="size-2.5" /> {writingCount} writing
                </span>
                {(isCurrent || isCompleted) && totalInLevel > 0 && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 rounded-full px-2 py-0.5">
                    {levelPct}% mastered
                  </span>
                )}
              </div>
            )}
          </div>
          {!isLocked && (
            <div className="shrink-0">
              {isExpanded ? (
                <ChevronUp className="size-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="size-4 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Expanded curriculum detail */}
        <AnimatePresence>
          {isExpanded && curriculum && !isLocked && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="px-3 sm:px-4 pb-4 pt-1 border-t border-border/50 space-y-4">
                {/* Teaching approach */}
                <div className="bg-muted/30 rounded-lg p-3">
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
                    Teaching Approach
                  </p>
                  <p className="text-xs text-foreground/80 leading-relaxed">
                    {curriculum.languageBalance}
                  </p>
                </div>

                {/* Grammar concepts */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="size-3.5 text-amber-500" />
                    <span className="text-xs font-semibold">Grammar Concepts</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">
                      {grammarCount}
                    </Badge>
                  </div>
                  <div className="grid gap-1.5">
                    {sortedGrammarConcepts.map((g) => {
                      const pct = getMasteryPct(g.conceptId);
                      const isSaved = savedConceptIds.has(g.conceptId);
                      return (
                        <div key={g.conceptId} className="flex items-center gap-2 group">
                          <div className={`size-5 rounded flex items-center justify-center shrink-0 ${
                            pct >= 70 ? "bg-emerald-500/15" : pct > 0 ? "bg-amber-500/15" : "bg-muted/50"
                          }`}>
                            {pct >= 70 ? (
                              <CheckCircle2 className="size-3 text-emerald-500" />
                            ) : (
                              <Circle className="size-3 text-muted-foreground/50" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{g.name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{g.description}</p>
                          </div>
                          {pct > 0 && (
                            <span className={`text-[10px] font-medium shrink-0 ${
                              pct >= 70 ? "text-emerald-500" : "text-amber-500"
                            }`}>
                              {pct}%
                            </span>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={`h-6 w-6 p-0 shrink-0 ${isSaved ? "text-primary" : "text-muted-foreground"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleSave(g.conceptId, g.name, "GRAMMAR", `${level} grammar concept`);
                            }}
                          >
                            <Bookmark className="size-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Vocabulary clusters */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="size-3.5 text-blue-500" />
                    <span className="text-xs font-semibold">Vocabulary Clusters</span>
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-auto">
                      {vocabCount}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {sortedVocabularyConcepts.map((v) => {
                      const pct = getMasteryPct(v.conceptId);
                      const isSaved = savedConceptIds.has(v.conceptId);
                      return (
                        <div
                          key={v.conceptId}
                          className={`rounded-lg border p-2 ${
                            pct >= 70 ? "border-emerald-500/20 bg-emerald-500/5" : "border-border/50 bg-muted/20"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-0.5 gap-1">
                            <p className="text-[11px] font-medium truncate">{v.name}</p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {pct > 0 && (
                                <span className={`text-[9px] font-medium ${
                                  pct >= 70 ? "text-emerald-500" : "text-amber-500"
                                }`}>
                                  {pct}%
                                </span>
                              )}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={`h-5 w-5 p-0 ${isSaved ? "text-primary" : "text-muted-foreground"}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onToggleSave(v.conceptId, v.name, "VOCABULARY", `${level} vocabulary cluster`);
                                }}
                              >
                                <Bookmark className="size-3" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {v.words.slice(0, 4).join(", ")}
                            {v.words.length > 4 && ` +${v.words.length - 4}`}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Task types */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <GraduationCap className="size-3.5 text-violet-500" />
                    <span className="text-xs font-semibold">Practice Activities</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Reading", tasks: curriculum.readingTasks, icon: Eye, color: "text-green-500", bg: "bg-green-500/10", locked: false },
                      { label: "Writing", tasks: curriculum.writingTasks, icon: PenTool, color: "text-indigo-500", bg: "bg-indigo-500/10", locked: false },
                      { label: "Speaking", tasks: curriculum.speakingTasks, icon: Mic, color: "text-rose-500", bg: "bg-rose-500/10", locked: true },
                      { label: "Listening", tasks: curriculum.listeningTasks, icon: Headphones, color: "text-cyan-500", bg: "bg-cyan-500/10", locked: true },
                    ].map(({ label, tasks, icon: Icon, color, bg, locked }) => (
                      <div key={label} className={`rounded-lg bg-muted/20 border border-border/50 p-2 ${locked ? "opacity-50" : ""}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <div className={`size-5 rounded ${bg} flex items-center justify-center`}>
                            <Icon className={`size-2.5 ${color}`} />
                          </div>
                          <span className="text-[11px] font-medium">{label}</span>
                          {locked ? (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto flex items-center gap-0.5">
                              <Lock className="size-2" /> Voice
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[8px] px-1 py-0 ml-auto">
                              {tasks.length}
                            </Badge>
                          )}
                        </div>
                        <ul className="space-y-0.5">
                          {tasks.slice(0, 2).map((t, i) => (
                            <li key={i} className="text-[10px] text-muted-foreground truncate">
                              • {t}
                            </li>
                          ))}
                          {tasks.length > 2 && (
                            <li className="text-[10px] text-muted-foreground/60">
                              +{tasks.length - 2} more
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mastery evidence */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Trophy className="size-3.5 text-amber-500" />
                    <span className="text-xs font-semibold">To advance, you need to:</span>
                  </div>
                  <ul className="space-y-1">
                    {curriculum.masteryEvidence.map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <Target className="size-3 mt-0.5 shrink-0 text-primary/50" />
                        <span>{e}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ProgressSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-8 w-48" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

export default function ProgressPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [conceptFilter, setConceptFilter] = useState<string>("all");
  const [showAllConcepts, setShowAllConcepts] = useState(false);
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);
  const [savedConcepts, setSavedConcepts] = useState<SavedConcept[]>([]);

  const targetLang = session?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchProgress();
  }, [status]);

  const fetchProgress = async () => {
    try {
      const [progressRes, notebookRes] = await Promise.all([
        fetch("/api/progress"),
        fetch("/api/concepts/notebook"),
      ]);
      if (!progressRes.ok) throw new Error("Failed to fetch");

      const data = await progressRes.json();
      setProgress(data);

      if (notebookRes.ok) {
        const notebookData = await notebookRes.json();
        setSavedConcepts(notebookData.concepts ?? []);
      }
    } catch (err) {
      console.error("Failed to fetch progress:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleSaveConcept = async (
    conceptId: string,
    conceptName: string,
    conceptType: string,
    context?: string
  ) => {
    const isSaved = savedConcepts.some((concept) => concept.conceptId === conceptId);

    try {
      if (isSaved) {
        const res = await fetch("/api/concepts/notebook", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conceptId }),
        });
        if (!res.ok) throw new Error("Delete failed");

        setSavedConcepts((prev) => prev.filter((concept) => concept.conceptId !== conceptId));
        toast.success("Removed from notebook");
        return;
      }

      const res = await fetch("/api/concepts/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId, conceptName, conceptType, context }),
      });
      if (!res.ok) throw new Error("Save failed");

      setSavedConcepts((prev) => [
        {
          conceptId,
          conceptName,
          conceptType,
          context: context ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        ...prev.filter((concept) => concept.conceptId !== conceptId),
      ]);
      toast.success("Saved to your notebook");
    } catch {
      toast.error("Could not update notebook");
    }
  };

  // Build a lookup map from conceptId → mastery data (must be above early returns)
  const masteryMap = useMemo(() => {
    const map = new Map<string, { score: number; count: number }>();
    if (progress?.masteries) {
      for (const m of progress.masteries) {
        map.set(m.conceptId, { score: m.masteryScore, count: m.practiceCount });
      }
    }
    return map;
  }, [progress?.masteries]);

  const currentLevel = progress?.profile?.currentLevel || "A0";

  // Auto-expand current level (must be above early returns)
  useEffect(() => {
    if (currentLevel && !expandedLevel) {
      setExpandedLevel(currentLevel);
    }
  }, [currentLevel]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="Progress" />
        <ProgressSkeleton />
      </Layout>
    );
  }

  if (!progress) {
    return (
      <Layout>
        <SEO title="Progress" />
        <div className="text-center py-12">
          <p className="text-muted-foreground">Unable to load progress data.</p>
          <Button variant="outline" className="mt-4" onClick={fetchProgress}>
            Retry
          </Button>
        </div>
      </Layout>
    );
  }

  const skills = progress.profile;
  const currentLevelIdx = CEFR_ORDER.indexOf(currentLevel as any);

  const grammarConcepts = progress.masteries.filter(
    (c) => c.conceptType === "GRAMMAR"
  );
  const vocabConcepts = progress.masteries.filter(
    (c) => c.conceptType === "VOCABULARY"
  );
  const cultureConcepts = progress.masteries.filter(
    (c) => c.conceptType === "CULTURE"
  );
  const grammarMastered = grammarConcepts.filter(
    (c) => c.masteryScore >= 0.7
  ).length;
  const vocabMastered = vocabConcepts.filter(
    (c) => c.masteryScore >= 0.7
  ).length;

  const filteredConcepts =
    conceptFilter === "all"
      ? progress.masteries
      : progress.masteries.filter((c) => c.conceptType === conceptFilter);
  const displayedConcepts = showAllConcepts
    ? filteredConcepts
    : filteredConcepts.slice(0, 8);
  const savedConceptIds = new Set(savedConcepts.map((concept) => concept.conceptId));

  return (
    <Layout>
      <SEO title="Progress" />
      <div className="space-y-5">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <BarChart3 className="size-5 text-primary" />
            <h1 className="text-2xl font-bold">Your Progress</h1>
          </div>
          {skills && (
            <Badge variant="secondary" className="text-sm font-bold px-3 py-1">
              {currentLevel}
            </Badge>
          )}
        </motion.div>

        {/* Stats Summary Row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3"
        >
          {[
            {
              label: "Sessions",
              value: progress.stats.totalSessions,
              icon: BookOpen,
              color: "text-blue-500",
              bg: "from-blue-500/10 to-blue-500/5",
              border: "border-blue-500/10",
            },
            {
              label: "Day Streak",
              value: `${progress.stats.currentStreak}`,
              icon: Flame,
              color: "text-orange-500",
              bg: "from-orange-500/10 to-orange-500/5",
              border: "border-orange-500/10",
            },
            {
              label: "Mastered",
              value: progress.stats.conceptsMastered,
              icon: Trophy,
              color: "text-amber-500",
              bg: "from-amber-500/10 to-amber-500/5",
              border: "border-amber-500/10",
            },
            {
              label: "Level Progress",
              value: `${progress.stats.levelProgress}%`,
              icon: Target,
              color: "text-primary",
              bg: "from-primary/10 to-primary/5",
              border: "border-primary/10",
            },
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 + i * 0.05, duration: 0.3 }}
              >
                <Card className={`overflow-hidden ${stat.border}`}>
                  <div className={`bg-gradient-to-b ${stat.bg}`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`size-4 ${stat.color}`} />
                        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">
                          {stat.label}
                        </span>
                      </div>
                      <p className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
                        {stat.value}
                      </p>
                    </CardContent>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Skill Breakdown */}
        {progress.masteries.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="size-4 text-primary" />
                  Learning Breakdown
                </CardTitle>
                <CardDescription className="text-xs">
                  Based on your actual conversation practice and AI evaluations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Grammar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <Brain className="size-3.5 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Grammar</p>
                        <p className="text-[10px] text-muted-foreground">
                          {grammarMastered} of {grammarConcepts.length} concepts
                          mastered
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-amber-500">
                      {grammarConcepts.length > 0
                        ? Math.round(
                            (grammarMastered / grammarConcepts.length) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      grammarConcepts.length > 0
                        ? (grammarMastered / grammarConcepts.length) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                {/* Vocabulary */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className="size-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <BookOpen className="size-3.5 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">Vocabulary</p>
                        <p className="text-[10px] text-muted-foreground">
                          {vocabMastered} of {vocabConcepts.length} concepts
                          mastered
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-blue-500">
                      {vocabConcepts.length > 0
                        ? Math.round(
                            (vocabMastered / vocabConcepts.length) * 100
                          )
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={
                      vocabConcepts.length > 0
                        ? (vocabMastered / vocabConcepts.length) * 100
                        : 0
                    }
                    className="h-2"
                  />
                </div>

                {/* Culture */}
                {cultureConcepts.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className="size-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Sparkles className="size-3.5 text-violet-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Culture</p>
                          <p className="text-[10px] text-muted-foreground">
                            {
                              cultureConcepts.filter(
                                (c) => c.masteryScore >= 0.7
                              ).length
                            }{" "}
                            of {cultureConcepts.length} explored
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-violet-500">
                        {Math.round(
                          (cultureConcepts.filter(
                            (c) => c.masteryScore >= 0.7
                          ).length /
                            cultureConcepts.length) *
                            100
                        )}
                        %
                      </span>
                    </div>
                    <Progress
                      value={
                        (cultureConcepts.filter((c) => c.masteryScore >= 0.7)
                          .length /
                          cultureConcepts.length) *
                        100
                      }
                      className="h-2"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Learning Roadmap */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Languages className="size-4 text-amber-500" />
                    Curriculum Roadmap
                  </CardTitle>
                  <CardDescription className="text-xs">
                    What {tutor.name} teaches at each level — tap to explore
                  </CardDescription>
                </div>
                <div className="flex items-center gap-1.5">
                  <ReactCountryFlag
                    countryCode={tutor.countryCode}
                    svg
                    style={{ width: "1.25rem", height: "1.25rem" }}
                    className="rounded-sm"
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {tutor.language}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {CEFR_ORDER.map((level, i) => {
                  const isCompleted = i < currentLevelIdx;
                  const isCurrent = level === currentLevel;
                  const isLocked = i > currentLevelIdx;
                  let curriculum = null;
                  try {
                    curriculum = getCurriculumForLevel(level as CEFRLevel, targetLang);
                  } catch {}
                  return (
                    <RoadmapNode
                      key={level}
                      level={level}
                      label={cefrLabel(level)}
                      isCurrent={isCurrent}
                      isCompleted={isCompleted}
                      isLocked={isLocked}
                      isExpanded={expandedLevel === level}
                      onToggle={() => setExpandedLevel(expandedLevel === level ? null : level)}
                      curriculum={curriculum}
                      masteryMap={masteryMap}
                      savedConceptIds={savedConceptIds}
                      onToggleSave={toggleSaveConcept}
                      delay={0.45 + i * 0.05}
                    />
                  );
                })}
              </div>
              {progress.stats.levelProgress > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">
                      Progress to next level
                    </span>
                    <span className="text-xs font-semibold">
                      {progress.stats.levelProgress}%
                    </span>
                  </div>
                  <Progress
                    value={progress.stats.levelProgress}
                    className="h-2"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Concept Notebook */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Bookmark className="size-4 text-primary" />
                Your Concept Notebook
              </CardTitle>
              <CardDescription className="text-xs">
                Save important concepts so each user keeps their own study shortlist
              </CardDescription>
            </CardHeader>
            <CardContent>
              {savedConcepts.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No saved concepts yet. Tap the bookmark icon in the roadmap or mastery list.
                </p>
              ) : (
                <div className="space-y-2">
                  {savedConcepts.slice(0, 8).map((concept) => (
                    <div key={concept.conceptId} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50">
                      <Bookmark className="size-3.5 text-primary shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold truncate">{concept.conceptName}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                          {concept.conceptType}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() =>
                          toggleSaveConcept(
                            concept.conceptId,
                            concept.conceptName,
                            concept.conceptType,
                            concept.context ?? undefined
                          )
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  {savedConcepts.length > 8 && (
                    <p className="text-[10px] text-muted-foreground text-center pt-1">
                      +{savedConcepts.length - 8} more saved concepts
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Concept Mastery */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  Concept Mastery
                </CardTitle>
                <Tabs
                  value={conceptFilter}
                  onValueChange={setConceptFilter}
                  className="w-auto"
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="text-xs px-2.5 h-6">
                      All
                    </TabsTrigger>
                    <TabsTrigger
                      value="GRAMMAR"
                      className="text-xs px-2.5 h-6"
                    >
                      Grammar
                    </TabsTrigger>
                    <TabsTrigger
                      value="VOCABULARY"
                      className="text-xs px-2.5 h-6"
                    >
                      Vocab
                    </TabsTrigger>
                    <TabsTrigger
                      value="CULTURE"
                      className="text-xs px-2.5 h-6"
                    >
                      Culture
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {filteredConcepts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="size-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    {conceptFilter === "GRAMMAR" ? (
                      <Brain className="size-6 text-muted-foreground" />
                    ) : conceptFilter === "VOCABULARY" ? (
                      <BookOpen className="size-6 text-muted-foreground" />
                    ) : conceptFilter === "CULTURE" ? (
                      <Sparkles className="size-6 text-muted-foreground" />
                    ) : (
                      <BookOpen className="size-6 text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-sm font-medium mb-1">
                    {conceptFilter === "all"
                      ? "No concepts practiced yet"
                      : `No ${conceptFilter.toLowerCase()} concepts yet`}
                  </p>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    {conceptFilter === "all"
                      ? "Your first lesson or conversation will start building your mastery map here."
                      : conceptFilter === "GRAMMAR"
                        ? "Grammar concepts will appear as your tutor introduces sentence structures and rules."
                        : conceptFilter === "VOCABULARY"
                          ? "Vocabulary will build up as you encounter and practice new words in conversation."
                          : "Cultural insights are woven into lessons as you advance through levels."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-2.5">
                    {displayedConcepts.map((concept, i) => {
                      const pct = Math.round(concept.masteryScore * 100);
                      const isMastered = pct >= 70;
                      const conceptName = getConceptName(concept.conceptId, targetLang);
                      const isSaved = savedConceptIds.has(concept.conceptId);
                      return (
                        <motion.div
                          key={concept.conceptId}
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: 0.6 + i * 0.03,
                            duration: 0.3,
                          }}
                          className="flex items-center gap-3"
                        >
                          <div
                            className={`size-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isMastered ? "bg-emerald-500/10" : "bg-muted/50"
                            }`}
                          >
                            {isMastered ? (
                              <CheckCircle2 className="size-4 text-emerald-500" />
                            ) : (
                              <Circle className="size-4 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium truncate capitalize">
                                {conceptName}
                              </span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className={`h-6 w-6 p-0 ${isSaved ? "text-primary" : "text-muted-foreground"}`}
                                  onClick={() =>
                                    toggleSaveConcept(
                                      concept.conceptId,
                                      conceptName,
                                      concept.conceptType,
                                      "Concept Mastery"
                                    )
                                  }
                                >
                                  <Bookmark className="size-3.5" />
                                </Button>
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1.5 py-0"
                                >
                                  {concept.practiceCount}x
                                </Badge>
                                <span
                                  className={`text-xs font-medium w-9 text-right ${
                                    isMastered
                                      ? "text-emerald-500"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {pct}%
                                </span>
                              </div>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  {filteredConcepts.length > 8 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-xs text-muted-foreground"
                      onClick={() => setShowAllConcepts(!showAllConcepts)}
                    >
                      {showAllConcepts ? (
                        <>
                          Show less <ChevronUp className="size-3 ml-1" />
                        </>
                      ) : (
                        <>
                          Show all {filteredConcepts.length} concepts{" "}
                          <ChevronDown className="size-3 ml-1" />
                        </>
                      )}
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
