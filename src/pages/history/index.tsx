import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { SessionInfo } from "@/types";
import { formatTimeAgo } from "@/lib/utils";
import { getConceptName } from "@/curriculum";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  MessageCircle,
  RotateCcw,
  GraduationCap,
  Clock,
  ChevronRight,
  History,
  CalendarDays,
  Sparkles,
  Target,
  Timer,
  Flame,
  TrendingUp,
  Zap,
  Brain,
  Eye,
  PenTool,
} from "lucide-react";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string; gradient: string; accent: string }
> = {
  LESSON: {
    label: "Lesson",
    icon: BookOpen,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    gradient: "from-blue-500/15 via-blue-500/5 to-transparent",
    accent: "bg-blue-500",
  },
  FREE_CONVERSATION: {
    label: "Conversation",
    icon: MessageCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    accent: "bg-emerald-500",
  },
  REVIEW: {
    label: "Review",
    icon: RotateCcw,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    gradient: "from-amber-500/15 via-amber-500/5 to-transparent",
    accent: "bg-amber-500",
  },
  PLACEMENT: {
    label: "Placement",
    icon: GraduationCap,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
    border: "border-violet-500/20",
    gradient: "from-violet-500/15 via-violet-500/5 to-transparent",
    accent: "bg-violet-500",
  },
  READING: {
    label: "Reading",
    icon: Eye,
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    gradient: "from-green-500/15 via-green-500/5 to-transparent",
    accent: "bg-green-500",
  },
  WRITING: {
    label: "Writing",
    icon: PenTool,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    gradient: "from-indigo-500/15 via-indigo-500/5 to-transparent",
    accent: "bg-indigo-500",
  },
};

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

function getDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  if (date >= today) return "Today";
  if (date >= yesterday) return "Yesterday";
  if (date >= weekAgo) return "This Week";
  if (date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear())
    return "This Month";
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export default function HistoryPage() {
  const router = useRouter();
  const { data: sessionData, status } = useSession();
  const targetLang = sessionData?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") fetchSessions();
  }, [status]);

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setSessions(data.sessions || data);
    } catch (err) {
      console.error("Failed to fetch sessions:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      typeFilter === "all"
        ? sessions
        : sessions.filter((s) => s.sessionType === typeFilter),
    [sessions, typeFilter]
  );

  const totalMessages = useMemo(
    () => sessions.reduce((sum, s) => sum + (s.messageCount || 0), 0),
    [sessions]
  );

  const analyzedCount = useMemo(
    () => sessions.filter((s) => s.summary).length,
    [sessions]
  );

  // Group filtered sessions by date
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: SessionInfo[] }[] = [];
    const map = new Map<string, SessionInfo[]>();
    for (const s of filtered) {
      const group = getDateGroup(s.startedAt);
      if (!map.has(group)) {
        map.set(group, []);
        groups.push({ label: group, sessions: map.get(group)! });
      }
      map.get(group)!.push(s);
    }
    return groups;
  }, [filtered]);

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="History — Lingua" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="History — Lingua" />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex items-center gap-3 mb-5"
        >
          <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
            <History className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-black">Session History</h1>
            <p className="text-xs text-muted-foreground">Your learning journey, session by session</p>
          </div>
        </motion.div>

        {sessions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.4 }}
          >
            <Card className="overflow-hidden border-violet-500/15">
              <div className="bg-gradient-to-br from-violet-500/8 via-transparent to-blue-500/5">
                <CardContent className="py-20 text-center">
                  <div className="size-20 rounded-2xl bg-gradient-to-br from-violet-500/15 to-blue-500/10 flex items-center justify-center mx-auto mb-5 ring-1 ring-violet-500/15">
                    <History className="size-8 text-violet-500" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Your story starts here</h3>
                  <p className="text-sm text-muted-foreground mb-6 max-w-xs mx-auto leading-relaxed">
                    Complete your first session and watch your learning journey unfold.
                  </p>
                  <Link
                    href="/practice"
                    className="inline-flex items-center gap-2 text-sm font-bold text-white bg-gradient-to-r from-violet-500 to-violet-600 hover:from-violet-600 hover:to-violet-700 px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40"
                  >
                    Start your first session
                    <ChevronRight className="size-4" />
                  </Link>
                </CardContent>
              </div>
            </Card>
          </motion.div>
        ) : (
          <>
            {/* Stats row */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.4 }}
              className="grid grid-cols-3 gap-3 mb-5"
            >
              {[
                {
                  label: "Sessions",
                  value: sessions.length,
                  icon: BookOpen,
                  color: "text-blue-500",
                  bg: "from-blue-500/15 to-blue-500/5",
                  border: "border-blue-500/15",
                  accent: "bg-blue-500",
                },
                {
                  label: "Messages",
                  value: totalMessages,
                  icon: MessageCircle,
                  color: "text-emerald-500",
                  bg: "from-emerald-500/15 to-emerald-500/5",
                  border: "border-emerald-500/15",
                  accent: "bg-emerald-500",
                },
                {
                  label: "Analyzed",
                  value: analyzedCount,
                  icon: Sparkles,
                  color: "text-violet-500",
                  bg: "from-violet-500/15 to-violet-500/5",
                  border: "border-violet-500/15",
                  accent: "bg-violet-500",
                  emptyHint: analyzedCount === 0 ? "Complete a session to see analysis" : undefined,
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
                      <div className={`h-1 ${stat.accent}`} />
                      <div className={`bg-gradient-to-b ${stat.bg}`}>
                        <CardContent className="p-3 sm:p-4">
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className={`size-6 rounded-md ${stat.accent}/10 flex items-center justify-center`}>
                              <Icon className={`size-3.5 ${stat.color}`} />
                            </div>
                            <span className="text-[10px] sm:text-xs text-muted-foreground font-semibold uppercase tracking-wide">
                              {stat.label}
                            </span>
                          </div>
                          <p className="text-3xl sm:text-4xl font-black tracking-tight leading-none">
                            {stat.value}
                          </p>
                          {"emptyHint" in stat && stat.emptyHint && (
                            <p className="text-[9px] text-muted-foreground mt-1">{stat.emptyHint}</p>
                          )}
                        </CardContent>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* Filter tabs */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.3 }}
              className="mb-5"
            >
              <Tabs value={typeFilter} onValueChange={setTypeFilter}>
                <TabsList className="h-8 w-full overflow-x-auto justify-start sm:w-auto sm:justify-center">
                  <TabsTrigger value="all" className="text-xs px-2.5 h-6">
                    All
                  </TabsTrigger>
                  <TabsTrigger value="LESSON" className="text-xs px-2.5 h-6">
                    Lessons
                  </TabsTrigger>
                  <TabsTrigger
                    value="FREE_CONVERSATION"
                    className="text-xs px-2.5 h-6"
                  >
                    Convos
                  </TabsTrigger>
                  <TabsTrigger value="REVIEW" className="text-xs px-2.5 h-6">
                    Reviews
                  </TabsTrigger>
                  <TabsTrigger value="READING" className="text-xs px-2.5 h-6">
                    Reading
                  </TabsTrigger>
                  <TabsTrigger value="WRITING" className="text-xs px-2.5 h-6">
                    Writing
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </motion.div>

            {/* Grouped session list */}
            <div className="space-y-6">
              {groupedSessions.map((group, gi) => (
                <motion.div
                  key={group.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + gi * 0.06, duration: 0.35 }}
                >
                  {/* Date group header — timeline chapter style */}
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                      <CalendarDays className="size-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-bold uppercase tracking-wide">
                        {group.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-2">
                        {group.sessions.length} session{group.sessions.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" />
                  </div>

                  {/* Sessions in group — DM-style cards */}
                  <div className="space-y-3">
                    {group.sessions.map((s, i) => {
                      const cfg =
                        TYPE_CONFIG[s.sessionType] || TYPE_CONFIG.LESSON;
                      const Icon = cfg.icon;
                      const duration = formatDuration(s.startedAt, s.endedAt);
                      const hasSummary = !!s.summary?.topicsCovered;
                      const concepts = s.focusConcepts || [];
                      const msgCount = s.messageCount || 0;
                      const isExpanded = expandedId === s.id;

                      return (
                        <motion.div
                          key={s.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            delay: 0.25 + gi * 0.06 + i * 0.03,
                            duration: 0.3,
                          }}
                        >
                          <Card
                            className={`transition-all duration-300 overflow-hidden border-l-3 ${
                              !s.endedAt
                                ? "border-l-primary animate-pulse"
                                : cfg.accent.replace("bg-", "border-l-")
                            } ${isExpanded ? "shadow-lg shadow-primary/10 border-primary/20" : "hover:shadow-lg hover:shadow-primary/5 hover:border-primary/20"}`}
                          >
                            {/* Subtle gradient accent on top edge */}
                            <div className={`h-1 bg-gradient-to-r ${cfg.gradient}`} />

                            {/* Collapsed DM-style header — always visible */}
                            <CardContent
                              className="p-4 cursor-pointer"
                              onClick={() => setExpandedId(isExpanded ? null : s.id)}
                            >
                              <div className="flex items-center gap-3">
                                {/* Tutor avatar for DM style */}
                                <div className={`size-11 rounded-full ${cfg.bg} flex items-center justify-center shrink-0 ring-1 ring-inset ring-black/5 dark:ring-white/5`}>
                                  <span className="text-sm font-black" style={{ color: 'inherit' }}>
                                    <Icon className={`size-5 ${cfg.color}`} />
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-bold">
                                      {cfg.label} #{s.sessionNumber}
                                    </span>
                                    {!s.endedAt && (
                                      <Badge className="text-[9px] px-2 py-0 h-[18px] bg-primary/15 text-primary border-0 animate-pulse font-semibold">
                                        Active
                                      </Badge>
                                    )}
                                    {hasSummary && (
                                      <div className="size-4 rounded-full bg-violet-500/10 flex items-center justify-center">
                                        <Sparkles className="size-2 text-violet-400" />
                                      </div>
                                    )}
                                  </div>
                                  {/* DM-style last message preview */}
                                  <p className="text-xs text-muted-foreground truncate">
                                    {hasSummary
                                      ? s.summary!.topicsCovered
                                      : concepts.length > 0
                                        ? concepts.slice(0, 2).map(c => getConceptName(c, targetLang)).join(", ")
                                        : `${msgCount} messages · ${duration}`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatTimeAgo(s.startedAt)}
                                  </span>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ChevronRight className={`size-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                  </motion.div>
                                </div>
                              </div>
                            </CardContent>

                            {/* Expanded detail — DM-style chat preview */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.3, ease: "easeInOut" }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 pt-0 border-t border-border/40">
                                    {/* Meta pills */}
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-3 mb-3">
                                      <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5">
                                        <MessageCircle className="size-2.5" />
                                        {msgCount} msgs
                                      </span>
                                      <span className="inline-flex items-center gap-1 bg-muted/40 rounded-full px-2 py-0.5">
                                        <Timer className="size-2.5" />
                                        {duration}
                                      </span>
                                      <Badge
                                        className={`text-[9px] px-2 py-0 h-[18px] ${cfg.bg} ${cfg.color} border-0 font-semibold`}
                                      >
                                        {cfg.label}
                                      </Badge>
                                    </div>

                                    {/* Summary as chat bubble from tutor */}
                                    {hasSummary && (
                                      <div className="flex items-start gap-2.5 mb-3">
                                        <div className="size-7 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 mt-0.5">
                                          <span className="text-[10px] font-black text-white">{tutor.name.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1 bg-muted/30 rounded-2xl rounded-tl-sm p-3 border border-border/30">
                                          <p className="text-xs leading-relaxed text-muted-foreground">
                                            {s.summary!.topicsCovered}
                                          </p>
                                        </div>
                                      </div>
                                    )}

                                    {/* Concept tags */}
                                    {concepts.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mb-3">
                                        {concepts.slice(0, 5).map((c) => (
                                          <Badge
                                            key={c}
                                            variant="secondary"
                                            className="text-[9px] px-2 py-0.5 h-5 capitalize gap-1 font-medium"
                                          >
                                            <Brain className="size-2.5" />
                                            {getConceptName(c, targetLang)}
                                          </Badge>
                                        ))}
                                        {concepts.length > 5 && (
                                          <Badge
                                            variant="secondary"
                                            className="text-[9px] px-2 py-0.5 h-5 font-medium"
                                          >
                                            +{concepts.length - 5}
                                          </Badge>
                                        )}
                                      </div>
                                    )}

                                    {/* View full chat button */}
                                    <Link
                                      href={!s.endedAt ? `/practice?session=${s.id}` : `/history/${s.id}`}
                                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {!s.endedAt ? (
                                        <>Resume session <ChevronRight className="size-3" /></>
                                      ) : (
                                        <>View full conversation <ChevronRight className="size-3" /></>
                                      )}
                                    </Link>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-16">
                  <div className="size-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                    <History className="size-7 text-muted-foreground/60" />
                  </div>
                  <h3 className="font-bold mb-1">No sessions match this filter</h3>
                  <p className="text-sm text-muted-foreground">
                    Try selecting a different session type above.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
