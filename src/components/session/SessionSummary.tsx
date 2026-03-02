import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { SessionSummaryData } from "@/types";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import ReactCountryFlag from "react-country-flag";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  BookOpen,
  MessageCircle,
  RotateCcw,
  Eye,
  PenTool,
  Clock,
  Zap,
  Star,
  TrendingUp,
  Target,
  ArrowRight,
  Home,
  ChevronRight,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface SessionSummaryProps {
  data: SessionSummaryData;
  targetLanguage: string;
  onBackToDashboard: () => void;
  onStartNewSession: () => void;
}

function AnimatedNumber({ from, to, delay = 0, suffix = "" }: { from: number; to: number; delay?: number; suffix?: string }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1000;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(from + (to - from) * eased));
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [from, to, delay]);

  return <span>{value}{suffix}</span>;
}

const SESSION_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
  LESSON: { label: "Structured Lesson", icon: <BookOpen className="size-5" />, color: "text-primary", bgColor: "bg-primary/10" },
  FREE_CONVERSATION: { label: "Free Conversation", icon: <MessageCircle className="size-5" />, color: "text-emerald-500", bgColor: "bg-emerald-500/10" },
  REVIEW: { label: "Review Session", icon: <RotateCcw className="size-5" />, color: "text-amber-500", bgColor: "bg-amber-500/10" },
  READING: { label: "Reading Session", icon: <Eye className="size-5" />, color: "text-green-500", bgColor: "bg-green-500/10" },
  WRITING: { label: "Writing Session", icon: <PenTool className="size-5" />, color: "text-indigo-500", bgColor: "bg-indigo-500/10" },
};

const PROGRESS_LABEL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  struggling: { label: "Needs Practice", color: "text-red-500", icon: <AlertCircle className="size-3.5" /> },
  making_progress: { label: "Making Progress", color: "text-amber-500", icon: <TrendingUp className="size-3.5" /> },
  getting_comfortable: { label: "Getting Comfortable", color: "text-blue-500", icon: <Zap className="size-3.5" /> },
  strong: { label: "Strong", color: "text-green-500", icon: <CheckCircle2 className="size-3.5" /> },
};

function AnimatedScore({ from, to, delay = 0 }: { from: number; to: number; delay?: number }) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 1200;
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    }, delay);
    return () => clearTimeout(timer);
  }, [from, to, delay]);

  return <span>{Math.round(value * 100)}%</span>;
}

function getConceptDisplayName(conceptId: string): string {
  // Convert concept IDs like "grammar.present_tense" to "Present Tense"
  const parts = conceptId.split(".");
  const name = parts[parts.length - 1]
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return name;
}

export default function SessionSummary({
  data,
  targetLanguage,
  onBackToDashboard,
  onStartNewSession,
}: SessionSummaryProps) {
  const tutor = getTutorConfig(targetLanguage);
  const typeConfig = SESSION_TYPE_CONFIG[data.sessionMeta.sessionType] || SESSION_TYPE_CONFIG.LESSON;
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowContent(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-background via-background to-primary/5"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.08 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute -top-32 -right-32 size-96 rounded-full bg-primary"
        />
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 0.05 }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
          className="absolute -bottom-24 -left-24 size-80 rounded-full bg-emerald-500"
        />
        {/* Confetti-like sparkles */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: -20, scale: 0 }}
            animate={{ opacity: [0, 1, 0], y: [0, 40, 80], scale: [0, 1, 0.5] }}
            transition={{ duration: 2, delay: 0.5 + i * 0.15, repeat: 0 }}
            className="absolute"
            style={{
              left: `${15 + i * 14}%`,
              top: `${5 + (i % 3) * 4}%`,
            }}
          >
            <Sparkles className="size-4 text-primary/40" />
          </motion.div>
        ))}
      </div>

      <div className="relative max-w-lg mx-auto px-4 py-8 sm:py-12">
        {/* Header - Session Complete Badge */}
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.1 }}
          className="text-center mb-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.2 }}
            className="inline-flex items-center justify-center size-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 mb-4 ring-4 ring-primary/10"
          >
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 0.5, delay: 0.8 }}
            >
              <Star className="size-10 text-primary fill-primary/20" />
            </motion.div>
          </motion.div>

          <motion.h1
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-2xl sm:text-3xl font-bold mb-2"
          >
            Session Complete!
          </motion.h1>

          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-3 text-sm text-muted-foreground"
          >
            <span className={`inline-flex items-center gap-1.5 ${typeConfig.color}`}>
              {typeConfig.icon}
              {typeConfig.label}
            </span>
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {data.sessionMeta.durationMinutes} min
            </span>
            <span className="text-border">|</span>
            <span className="inline-flex items-center gap-1">
              <MessageCircle className="size-3.5" />
              {data.sessionMeta.exchangeCount} exchanges
            </span>
          </motion.div>
        </motion.div>

        <AnimatePresence>
          {showContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="space-y-4"
            >
              {/* XP Earned Card */}
              {data.xpAwarded != null && data.xpAwarded > 0 && (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.05 }}
                >
                  <Card className="border-yellow-500/25 bg-gradient-to-r from-yellow-500/10 via-amber-500/8 to-yellow-500/5 overflow-hidden relative">
                    <div className="absolute inset-0 pointer-events-none">
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-yellow-400/10 to-transparent"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 2.5, repeat: 2, ease: "easeInOut" }}
                      />
                    </div>
                    <CardContent className="p-4 flex items-center gap-4 relative">
                      <motion.div
                        initial={{ rotate: -20, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ type: "spring", delay: 0.3 }}
                        className="size-12 rounded-xl bg-gradient-to-br from-yellow-400/30 to-amber-500/20 flex items-center justify-center ring-1 ring-yellow-500/30"
                      >
                        <Zap className="size-6 text-yellow-500" />
                      </motion.div>
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground font-medium">XP Earned</p>
                        <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">
                          +<AnimatedNumber from={0} to={data.xpAwarded} delay={500} suffix=" XP" />
                        </p>
                      </div>
                      {data.leveledUp && (
                        <motion.div
                          initial={{ scale: 0, rotate: -10 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", delay: 1.2 }}
                        >
                          <Badge className="bg-gradient-to-r from-primary to-violet-500 text-white border-0 text-xs font-bold px-3 py-1 shadow-lg shadow-primary/30">
                            <Star className="size-3 mr-1 fill-white/40" />
                            Level Up!
                          </Badge>
                        </motion.div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Concept Progress Cards */}
              {data.conceptResults.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.1 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                        <Target className="size-4 text-primary" />
                        Concept Progress
                      </h3>
                      <div className="space-y-4">
                        {data.conceptResults.map((concept, i) => {
                          const progressConfig = PROGRESS_LABEL_CONFIG[concept.progressLabel] || PROGRESS_LABEL_CONFIG.making_progress;
                          const deltaPrefix = concept.delta >= 0 ? "+" : "";
                          return (
                            <motion.div
                              key={concept.conceptId}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ delay: 0.2 + i * 0.12 }}
                              className="space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">
                                    {getConceptDisplayName(concept.conceptId)}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className={`text-[10px] px-1.5 py-0 ${progressConfig.color}`}
                                  >
                                    {progressConfig.icon}
                                    <span className="ml-0.5">{progressConfig.label}</span>
                                  </Badge>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-bold">
                                    <AnimatedScore
                                      from={concept.previousScore}
                                      to={concept.newScore}
                                      delay={600 + i * 120}
                                    />
                                  </span>
                                  <span
                                    className={`text-[11px] ml-1.5 font-medium ${
                                      concept.delta > 0
                                        ? "text-green-500"
                                        : concept.delta < 0
                                          ? "text-red-500"
                                          : "text-muted-foreground"
                                    }`}
                                  >
                                    {deltaPrefix}{Math.round(concept.delta * 100)}%
                                  </span>
                                </div>
                              </div>
                              <div className="relative">
                                {/* Previous score bar (faded) */}
                                <Progress
                                  value={concept.previousScore * 100}
                                  className="h-2 opacity-30"
                                />
                                {/* New score bar (animated overlay) */}
                                <motion.div
                                  className="absolute inset-0"
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.5 + i * 0.12 }}
                                >
                                  <Progress
                                    value={concept.newScore * 100}
                                    className="h-2"
                                  />
                                </motion.div>
                              </div>
                              {concept.evidence && (
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                  {concept.evidence}
                                </p>
                              )}
                              {concept.sessionsWithEvidence < 3 && concept.newScore >= 0.6 && (
                                <p className="text-[10px] text-amber-500 flex items-center gap-1">
                                  <AlertCircle className="size-3" />
                                  {3 - concept.sessionsWithEvidence} more session{3 - concept.sessionsWithEvidence !== 1 ? "s" : ""} needed before mastery
                                </p>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* What You Did Well */}
              {data.sessionHighlights.didWell.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-green-500/0">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-green-600 dark:text-green-400">
                        <CheckCircle2 className="size-4" />
                        What You Did Well
                      </h3>
                      <ul className="space-y-2">
                        {data.sessionHighlights.didWell.map((item, i) => (
                          <motion.li
                            key={i}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.4 + i * 0.1 }}
                            className="flex items-start gap-2 text-sm"
                          >
                            <ChevronRight className="size-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Focus for Next Time */}
              {data.sessionHighlights.focusNextTime.length > 0 && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-amber-500/0">
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Target className="size-4" />
                        Focus for Next Time
                      </h3>
                      <ul className="space-y-2">
                        {data.sessionHighlights.focusNextTime.map((item, i) => (
                          <motion.li
                            key={i}
                            initial={{ x: -10, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.5 + i * 0.1 }}
                            className="flex items-start gap-2 text-sm"
                          >
                            <ChevronRight className="size-4 text-amber-500 mt-0.5 shrink-0" />
                            <span>{item}</span>
                          </motion.li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Tutor's Closing Note */}
              {data.sessionHighlights.tutorClosingNote && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.5 }}
                >
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0">
                    <CardContent className="p-5">
                      <div className="flex items-start gap-3">
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 ring-2 ring-primary/10">
                          <ReactCountryFlag
                            countryCode={tutor.countryCode}
                            svg
                            style={{ width: "1.25rem", height: "1.25rem" }}
                            className="rounded"
                          />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-primary mb-1">
                            {tutor.name} says...
                          </p>
                          <p className="text-sm leading-relaxed italic text-foreground/80">
                            &ldquo;{data.sessionHighlights.tutorClosingNote}&rdquo;
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Vocabulary Recap */}
              {data.summary.vocabularyIntroduced && (
                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.55 }}
                >
                  <Card>
                    <CardContent className="p-5">
                      <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                        <BookOpen className="size-4 text-blue-500" />
                        Vocabulary Practiced
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {data.summary.vocabularyIntroduced.split(",").map((word, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {word.trim()}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Navigation Buttons */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="flex flex-col sm:flex-row gap-3 pt-4 pb-8"
              >
                <Button
                  variant="outline"
                  className="flex-1 h-12 gap-2"
                  onClick={onBackToDashboard}
                >
                  <Home className="size-4" />
                  Back to Dashboard
                </Button>
                <Button
                  className="flex-1 h-12 gap-2"
                  onClick={onStartNewSession}
                >
                  Start Another Session
                  <ArrowRight className="size-4" />
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
