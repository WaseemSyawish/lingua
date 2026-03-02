import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import { ChatMessage, SessionAnalysis } from "@/types";
import { formatDate, formatTimeAgo } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  MessageCircle,
  Clock,
  BookOpen,
  RotateCcw,
  GraduationCap,
  Sparkles,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Target,
  Brain,
  Timer,
  Eye,
  PenTool,
} from "lucide-react";
import { getConceptName } from "@/curriculum";

const TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string }
> = {
  LESSON: { label: "Lesson", icon: BookOpen, color: "text-blue-500", bg: "bg-blue-500/10" },
  FREE_CONVERSATION: {
    label: "Conversation",
    icon: MessageCircle,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  REVIEW: { label: "Review", icon: RotateCcw, color: "text-amber-500", bg: "bg-amber-500/10" },
  PLACEMENT: {
    label: "Placement",
    icon: GraduationCap,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  READING: { label: "Reading", icon: Eye, color: "text-green-500", bg: "bg-green-500/10" },
  WRITING: { label: "Writing", icon: PenTool, color: "text-indigo-500", bg: "bg-indigo-500/10" },
};

interface SessionDetail {
  id: string;
  sessionNumber: number;
  sessionType: string;
  startedAt: string;
  endedAt: string | null;
  messages: ChatMessage[];
  summary: string | null;
  focusConcepts: string[];
  analysis: SessionAnalysis | null;
}

export default function SessionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { data: sessionData, status } = useSession();
  const targetLang = sessionData?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && id) fetchSession();
  }, [status, id]);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();
      setSession(data.session || data);
    } catch (err) {
      console.error("Failed to fetch session:", err);
      router.replace("/history");
    } finally {
      setLoading(false);
    }
  };

  const analyzeSession = async () => {
    if (!session) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 400 && data.detail) {
          toast.error(data.detail);
        } else {
          toast.error("Analysis failed — please try again later.");
        }
        return;
      }
      toast.success("Session analyzed successfully!");
      fetchSession();
    } catch (err) {
      console.error("Analysis failed:", err);
      toast.error("Analysis failed — check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <Layout>
        <SEO title="Session — Lingua" />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!session) return null;

  const cfg = TYPE_CONFIG[session.sessionType] || TYPE_CONFIG.LESSON;
  const Icon = cfg.icon;
  const conversationMessages = session.messages.filter(
    (m) => m.role !== "system"
  );

  // Calculate duration
  const duration = (() => {
    if (!session.endedAt) return "In progress";
    const ms = new Date(session.endedAt).getTime() - new Date(session.startedAt).getTime();
    const mins = Math.round(ms / 60000);
    if (mins < 1) return "<1 min";
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem > 0 ? `${hrs}h ${rem}m` : `${hrs}h`;
  })();

  const analysisCards = session.analysis
    ? [
        { label: "Topics Covered", value: session.analysis.topicsCovered, icon: Target, color: "text-blue-500", bg: "bg-blue-500/10" },
        { label: "Vocabulary", value: session.analysis.vocabularyIntroduced, icon: BookOpen, color: "text-emerald-500", bg: "bg-emerald-500/10" },
        { label: "Grammar", value: session.analysis.grammarPracticed, icon: Brain, color: "text-purple-500", bg: "bg-purple-500/10" },
        { label: "Errors", value: session.analysis.errorsObserved, icon: AlertCircle, color: "text-orange-500", bg: "bg-orange-500/10" },
      ].filter(({ value }) => value)
    : [];

  return (
    <Layout>
      <SEO title={`Session #${session.sessionNumber} — Lingua`} />
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10">
        {/* Back link */}
        <motion.div
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Link
            href="/history"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-5"
          >
            <ArrowLeft className="size-4" />
            Back to History
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="flex items-start justify-between mb-5"
        >
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <div className={`size-9 rounded-xl flex items-center justify-center ${cfg.bg}`}>
                <Icon className={`size-4.5 ${cfg.color}`} />
              </div>
              <h1 className="text-2xl font-bold">
                Session #{session.sessionNumber}
              </h1>
            </div>
            <div className="flex items-center flex-wrap gap-2 sm:gap-3 text-xs text-muted-foreground ml-0 sm:ml-[46px]">
              <Badge variant="outline" className="text-[10px] gap-1 px-1.5 py-0">
                {cfg.label}
              </Badge>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDate(session.startedAt)}
              </span>
              <span className="flex items-center gap-1">
                <Timer className="size-3" />
                {duration}
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle className="size-3" />
                {session.messages.length} msgs
              </span>
            </div>
          </div>
          {!session.endedAt && (
            <Button
              size="sm"
              onClick={() =>
                router.push(`/practice?session=${session.id}`)
              }
            >
              <Play className="size-3 mr-1" />
              Resume
            </Button>
          )}
        </motion.div>

        {/* Summary & Focus Concepts */}
        {(session.summary ||
          (session.focusConcepts && session.focusConcepts.length > 0)) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.4 }}
          >
            <Card className="mb-5">
              <CardContent className="p-4">
                {session.summary && (
                  <p className="text-sm text-muted-foreground mb-3 leading-relaxed">
                    {session.summary}
                  </p>
                )}
                {session.focusConcepts && session.focusConcepts.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Target className="size-3.5 text-primary" />
                      <span className="text-xs font-semibold">Focus Concepts</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {session.focusConcepts.map((c) => (
                        <Badge key={c} variant="secondary" className="text-[10px] px-2 py-0.5 capitalize">
                          {getConceptName(c, targetLang)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Analysis */}
        {session.analysis ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <Card className="mb-5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="size-4 text-primary" />
                  AI Analysis
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {analysisCards.map(({ label, value, icon: AIcon, color, bg }) => (
                  <div key={label} className="flex items-start gap-3">
                    <div className={`size-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${bg}`}>
                      <AIcon className={`size-3.5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold mb-0.5">{label}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{value}</p>
                    </div>
                  </div>
                ))}
                {session.analysis.overallNotes && (
                  <div className="pt-2 border-t mt-3">
                    <p className="text-xs font-semibold mb-1">Overall Notes</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {session.analysis.overallNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          session.endedAt && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.4 }}
              className="mb-5"
            >
              <Button
                variant="outline"
                onClick={analyzeSession}
                disabled={analyzing}
                className="gap-2"
              >
                {analyzing ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {analyzing ? "Analyzing..." : "Analyze Session"}
              </Button>
            </motion.div>
          )
        )}

        {/* Conversation — DM-style */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageCircle className="size-4 text-primary" />
                Conversation
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {conversationMessages.length} messages
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-5">
              {conversationMessages.length === 0 ? (
                <div className="text-center py-10">
                  <div className="size-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="size-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No messages in this session.
                  </p>
                </div>
              ) : (
                conversationMessages.map((msg, i) => {
                  const isAssistant = msg.role === "assistant";
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + i * 0.02, duration: 0.25 }}
                      className={`flex items-start gap-2.5 ${isAssistant ? "" : "flex-row-reverse"}`}
                    >
                      {/* Avatar */}
                      {isAssistant ? (
                        <div className="size-8 rounded-full bg-gradient-to-br from-violet-500 to-violet-700 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <span className="text-xs font-black text-white">{tutor.name.charAt(0)}</span>
                        </div>
                      ) : (
                        <div className="size-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                          <span className="text-xs font-black text-primary-foreground">
                            {sessionData?.user?.name?.charAt(0).toUpperCase() || "U"}
                          </span>
                        </div>
                      )}
                      {/* Message bubble */}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                          isAssistant
                            ? "bg-muted/40 rounded-tl-sm border border-border/30"
                            : "bg-primary text-primary-foreground rounded-tr-sm"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
