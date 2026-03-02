import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import ChatInterface from "@/components/chat/ChatInterface";
import SessionSummaryScreen from "@/components/session/SessionSummary";
import { ChatMessage, SessionSummaryData } from "@/types";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import { getCurriculumForLevel } from "@/curriculum";
import { CEFRLevel } from "@/generated/prisma/enums";
import ReactCountryFlag from "react-country-flag";
import {
  Card,
  CardContent,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen,
  MessageCircle,
  RotateCcw,
  ArrowRight,
  Sparkles,
  Zap,
  Mic,
  Brain,
  Headphones,
  Eye,
  PenTool,
  ChevronDown,
  ChevronUp,
  Volume2,
  Target,
  Lock,
  Clock,
  Play,
  CheckCircle2,
  Coffee,
  Film,
  Utensils,
  Plane,
  Music,
  Briefcase,
  Heart,
  Gamepad2,
  GraduationCap,
} from "lucide-react";

type SessionLength = "quick" | "standard" | "deep";
const SESSION_LENGTHS: { id: SessionLength; label: string; duration: string; desc: string }[] = [
  { id: "quick", label: "Quick", duration: "~10 min", desc: "Short & focused" },
  { id: "standard", label: "Standard", duration: "~15 min", desc: "Balanced session" },
  { id: "deep", label: "Deep", duration: "~20 min", desc: "Extended practice" },
];

type SessionTypeOption = "LESSON" | "FREE_CONVERSATION" | "REVIEW" | "READING" | "WRITING";

const CONVERSATION_TOPICS = [
  { id: "daily-life", label: "Daily Life", desc: "Routines, habits & everyday moments", icon: Coffee },
  { id: "travel", label: "Travel", desc: "Adventures, destinations & cultures", icon: Plane },
  { id: "food", label: "Food & Cooking", desc: "Recipes, restaurants & cuisines", icon: Utensils },
  { id: "entertainment", label: "Entertainment", desc: "Movies, shows, books & games", icon: Film },
  { id: "music", label: "Music & Art", desc: "Songs, concerts & creative arts", icon: Music },
  { id: "work", label: "Work & Career", desc: "Professional life & goals", icon: Briefcase },
  { id: "hobbies", label: "Hobbies & Sports", desc: "Passions, fitness & fun", icon: Gamepad2 },
  { id: "relationships", label: "Family & Friends", desc: "People in your life & social events", icon: Heart },
  { id: "education", label: "Learning & School", desc: "Studies, classes & knowledge", icon: GraduationCap },
  { id: "surprise", label: "Surprise me!", desc: "Let the tutor pick something fun", icon: Sparkles },
];

const SESSION_TYPES: {
  type: SessionTypeOption;
  label: string;
  description: string;
  detail: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  gradient: string;
  features: { icon: React.ReactNode; label: string }[];
}[] = [
  {
    type: "LESSON",
    label: "Structured Lesson",
    description:
      "Guided lesson tailored to your curriculum level",
    detail:
      "Your tutor introduces new grammar and vocabulary from your current level, explains concepts in context with examples, then guides you through practice exercises. Every exchange has a deliberate teaching purpose.",
    icon: <BookOpen className="size-6" />,
    color: "text-primary",
    bgColor: "bg-primary/10",
    gradient: "from-primary/5 to-primary/10",
    features: [
      { icon: <Brain className="size-3" />, label: "Grammar & vocab" },
      { icon: <Target className="size-3" />, label: "Level-matched" },
      { icon: <Zap className="size-3" />, label: "4-phase flow" },
    ],
  },
  {
    type: "READING",
    label: "Reading Session",
    description:
      "Practice comprehension with passages at your level",
    detail:
      "Your tutor presents a short reading passage, guides you through comprehension questions, highlights key vocabulary and grammar, then asks you to summarize and respond. Great for building passive vocabulary.",
    icon: <Eye className="size-6" />,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    gradient: "from-green-500/5 to-green-500/10",
    features: [
      { icon: <Eye className="size-3" />, label: "Comprehension" },
      { icon: <BookOpen className="size-3" />, label: "Vocabulary" },
      { icon: <Brain className="size-3" />, label: "Context clues" },
    ],
  },
  {
    type: "WRITING",
    label: "Writing Session",
    description:
      "Improve your writing with guided exercises and feedback",
    detail:
      "You'll receive a writing prompt, submit your draft, and get specific corrections on grammar, vocabulary, and style. Then revise and try an extension exercise. Writing makes grammar stick.",
    icon: <PenTool className="size-6" />,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
    gradient: "from-indigo-500/5 to-indigo-500/10",
    features: [
      { icon: <PenTool className="size-3" />, label: "Draft & revise" },
      { icon: <Brain className="size-3" />, label: "Grammar focus" },
      { icon: <Sparkles className="size-3" />, label: "Detailed feedback" },
    ],
  },
  {
    type: "FREE_CONVERSATION",
    label: "Free Conversation",
    description:
      "Practice natural conversation on any topic",
    detail:
      "Chat freely with your tutor about topics you enjoy. They'll gently correct mistakes, introduce new expressions, and keep you speaking. Perfect for building confidence and fluency.",
    icon: <MessageCircle className="size-6" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    gradient: "from-emerald-500/5 to-emerald-500/10",
    features: [
      { icon: <Sparkles className="size-3" />, label: "Natural flow" },
      { icon: <MessageCircle className="size-3" />, label: "Any topic" },
      { icon: <Volume2 className="size-3" />, label: "Voice available" },
    ],
  },
  {
    type: "REVIEW",
    label: "Review Session",
    description:
      "Reinforce concepts you've been learning",
    detail:
      "Your tutor revisits grammar rules and vocabulary you've practiced before, using spaced repetition to test your retention. Focuses on areas where your mastery score is below 70%.",
    icon: <RotateCcw className="size-6" />,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
    gradient: "from-amber-500/5 to-amber-500/10",
    features: [
      { icon: <RotateCcw className="size-3" />, label: "Spaced review" },
      { icon: <Brain className="size-3" />, label: "Weak areas" },
      { icon: <Zap className="size-3" />, label: "Retention boost" },
    ],
  },
];

export default function PracticePage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [pendingSessionType, setPendingSessionType] = useState<SessionTypeOption | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [expandedType, setExpandedType] = useState<SessionTypeOption | null>(null);
  const [stats, setStats] = useState<{ totalSessions: number; currentLevel: string; conceptsMastered: number; totalConceptsInLevel: number } | null>(null);
  const [summaryData, setSummaryData] = useState<SessionSummaryData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isWrappingUp, setIsWrappingUp] = useState(false);
  const [reviewPickerOpen, setReviewPickerOpen] = useState(false);
  const [reviewConcepts, setReviewConcepts] = useState<any[]>([]);
  const [selectedReviewConcepts, setSelectedReviewConcepts] = useState<string[]>([]);
  const [reviewFreeText, setReviewFreeText] = useState("");
  const [lengthPickerType, setLengthPickerType] = useState<SessionTypeOption | null>(null);
  const [selectedLength, setSelectedLength] = useState<SessionLength>("standard");
  const [topicPickerOpen, setTopicPickerOpen] = useState(false);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [customTopic, setCustomTopic] = useState("");
  const [conversationTopic, setConversationTopic] = useState<string | null>(null);

  const targetLang = session?.user?.targetLanguage || "fr";
  const tutor = getTutorConfig(targetLang);

  // Fetch basic stats for curriculum preview
  useEffect(() => {
    if (session?.user) {
      fetch("/api/progress")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data) {
            setStats({
              totalSessions: data.stats?.totalSessions || 0,
              currentLevel: data.profile?.currentLevel || "A0",
              conceptsMastered: data.stats?.conceptsMastered || 0,
              totalConceptsInLevel: data.stats?.totalConceptsInLevel || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [session]);

  // Get curriculum for current level
  const curriculum = useMemo(() => {
    if (!stats?.currentLevel) return null;
    try {
      return getCurriculumForLevel(stats.currentLevel as CEFRLevel, targetLang);
    } catch {
      return null;
    }
  }, [stats?.currentLevel, targetLang]);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  // Resume session from query param
  useEffect(() => {
    const { session: sessionId } = router.query;
    if (sessionId && typeof sessionId === "string" && !activeSession) {
      resumeSession(sessionId);
    }
  }, [router.query]);

  const resumeSession = async (sessionId: string) => {
    setResuming(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Session not found");
      const data = await res.json();
      setInitialMessages(data.session?.messages || data.messages || []);
      setActiveSession(sessionId);
    } catch (err) {
      console.error("Failed to resume session:", err);
      router.replace("/practice");
    } finally {
      setResuming(false);
    }
  };

  // Lazy session creation: just set the type, session is created on first message
  const startSession = (type: SessionTypeOption) => {
    if (type === "REVIEW") {
      // Fetch concepts for review picker
      fetch("/api/progress")
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.masteries) {
            // Include ALL concepts — weak ones first, then due-for-refresh mastered ones
            const weak = [...data.masteries]
              .filter((m: any) => m.masteryScore < 0.7)
              .sort((a: any, b: any) => {
                const scoreDiff = a.masteryScore - b.masteryScore;
                if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
                const dateA = a.lastPracticed ? new Date(a.lastPracticed).getTime() : 0;
                const dateB = b.lastPracticed ? new Date(b.lastPracticed).getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 4);

            // Mastered but due for refresh (oldest practice dates first)
            const mastered = [...data.masteries]
              .filter((m: any) => m.masteryScore >= 0.7)
              .sort((a: any, b: any) => {
                const dateA = a.lastPracticed ? new Date(a.lastPracticed).getTime() : 0;
                const dateB = b.lastPracticed ? new Date(b.lastPracticed).getTime() : 0;
                return dateA - dateB;
              })
              .slice(0, 4);

            setReviewConcepts([...weak, ...mastered].slice(0, 8));
          }
          setReviewPickerOpen(true);
        })
        .catch(() => {
          setReviewPickerOpen(true);
        });
      return;
    }
    if (type === "FREE_CONVERSATION") {
      setTopicPickerOpen(true);
      setSelectedTopic(null);
      setCustomTopic("");
      return;
    }
    // Show pre-session length picker for other types
    setLengthPickerType(type);
    setSelectedLength("standard");
  };

  const confirmLengthAndStart = () => {
    if (!lengthPickerType) return;
    setPendingSessionType(lengthPickerType);
    setLengthPickerType(null);
    setInitialMessages([]);
  };

  const confirmTopicAndContinue = () => {
    const topic = customTopic.trim() || (selectedTopic === "surprise" ? null : selectedTopic
      ? CONVERSATION_TOPICS.find((t) => t.id === selectedTopic)?.label || null
      : null);
    setConversationTopic(topic ? `The learner wants to talk about: ${topic}` : null);
    setTopicPickerOpen(false);
    // Proceed to length picker
    setLengthPickerType("FREE_CONVERSATION");
    setSelectedLength("standard");
  };

  const startReviewSession = () => {
    setReviewPickerOpen(false);
    setPendingSessionType("REVIEW");
    setInitialMessages([]);
  };

  // Called by ChatInterface when session is lazily created
  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
  }, []);

  const handleSessionEnd = useCallback(() => {
    setActiveSession(null);
    setPendingSessionType(null);
    setInitialMessages([]);
    setSummaryData(null);
    setLengthPickerType(null);
    setConversationTopic(null);
    router.replace("/practice", undefined, { shallow: true });
  }, [router]);

  // Called when [SESSION_COMPLETE] is detected — pause, then analyze and show summary
  const handleSessionComplete = useCallback(async (completedSessionId: string) => {
    // Step 1: Show "Wrapping up..." indicator after a generous pause for the final message to display
    await new Promise((resolve) => setTimeout(resolve, 4500));
    setIsWrappingUp(true);
    
    // Step 2: After wrapping up indicator shows, transition to analyzing
    await new Promise((resolve) => setTimeout(resolve, 3000));
    setIsWrappingUp(false);
    setIsAnalyzing(true);
    
    try {
      const res = await fetch(`/api/sessions/${completedSessionId}/analyze`, {
        method: "POST",
      });
      if (!res.ok) {
        console.error("Analysis failed:", res.status);
        handleSessionEnd();
        return;
      }
      const data: SessionSummaryData = await res.json();
      setSummaryData(data);
    } catch (err) {
      console.error("Failed to analyze session:", err);
      handleSessionEnd();
    } finally {
      setIsAnalyzing(false);
    }
  }, [handleSessionEnd]);

  const handleSummaryBackToDashboard = useCallback(() => {
    setSummaryData(null);
    setActiveSession(null);
    setPendingSessionType(null);
    setInitialMessages([]);
    router.push("/dashboard");
  }, [router]);

  const handleSummaryStartNew = useCallback(() => {
    setSummaryData(null);
    setActiveSession(null);
    setPendingSessionType(null);
    setInitialMessages([]);
    setConversationTopic(null);
    router.replace("/practice", undefined, { shallow: true });
  }, [router]);

  if (status === "loading" || resuming) {
    return (
      <Layout>
        <SEO title="Practice — Lingua" />
        <div className="max-w-3xl mx-auto px-4 py-12 space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
          <div className="grid gap-4 mt-8">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  // Show summary screen when analysis is complete
  if (summaryData) {
    return (
      <>
        <SEO title="Session Summary — Lingua" />
        <SessionSummaryScreen
          data={summaryData}
          targetLanguage={session?.user?.targetLanguage || "fr"}
          onBackToDashboard={handleSummaryBackToDashboard}
          onStartNewSession={handleSummaryStartNew}
        />
      </>
    );
  }

  // Pre-session length selection screen
  if (lengthPickerType) {
    const sessionConfig = SESSION_TYPES.find((s) => s.type === lengthPickerType);
    return (
      <Layout>
        <SEO title="Get Ready — Lingua" />
        <div className="max-w-lg mx-auto px-4 py-8 sm:py-16">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            {/* Tutor avatar */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.5 }}
              className="relative inline-block mb-5"
            >
              <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-primary/30 to-violet-500/20 blur-xl animate-pulse" />
              <div className="relative size-24 rounded-full bg-gradient-to-br from-primary/15 to-primary/5 ring-2 ring-primary/20 flex items-center justify-center shadow-xl">
                <ReactCountryFlag
                  countryCode={tutor.countryCode}
                  svg
                  style={{ width: "2.5rem", height: "2.5rem" }}
                  className="rounded-lg"
                />
              </div>
            </motion.div>

            {/* Session type name */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
            >
              {sessionConfig && (
                <Badge className={`${sessionConfig.bgColor} ${sessionConfig.color} border-0 text-xs font-bold px-3 py-1 mb-3`}>
                  {sessionConfig.icon}
                  <span className="ml-1.5">{sessionConfig.label}</span>
                </Badge>
              )}
              <h1 className="text-2xl font-bold mb-1">
                Ready to practice with {tutor.name}?
              </h1>
              <p className="text-sm text-muted-foreground mb-8">
                How long would you like to practice?
              </p>
            </motion.div>

            {/* Length options */}
            <motion.div
              initial={{ y: 15, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="grid grid-cols-3 gap-3 mb-8"
            >
              {SESSION_LENGTHS.map((len) => {
                const isSelected = selectedLength === len.id;
                return (
                  <button
                    key={len.id}
                    onClick={() => setSelectedLength(len.id)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      isSelected
                        ? "border-primary bg-primary/10 shadow-lg shadow-primary/10 scale-[1.02]"
                        : "border-border/60 bg-card hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    {len.id === "standard" && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 text-[8px] font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Default
                      </div>
                    )}
                    <Clock className={`size-5 mx-auto mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <p className={`text-sm font-bold ${isSelected ? "text-primary" : ""}`}>{len.label}</p>
                    <p className={`text-lg font-black ${isSelected ? "text-primary" : ""}`}>{len.duration}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{len.desc}</p>
                  </button>
                );
              })}
            </motion.div>

            <p className="text-[10px] text-muted-foreground mb-5 italic">
              Session length is a soft target — {tutor.name} will naturally wrap up around this time
            </p>

            {/* Action buttons */}
            <motion.div
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="flex gap-3"
            >
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setLengthPickerType(null)}
              >
                Back
              </Button>
              <Button
                className="flex-1 gap-2 text-base py-5"
                onClick={confirmLengthAndStart}
              >
                <Play className="size-4" />
                Start Session
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  // Review concept picker
  if (reviewPickerOpen) {
    const toggleConcept = (id: string) => {
      setSelectedReviewConcepts((prev) =>
        prev.includes(id) ? prev.filter((c) => c !== id) : prev.length < 3 ? [...prev, id] : prev
      );
    };
    return (
      <Layout>
        <SEO title="Review — Lingua" />
        <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="text-center mb-6">
              <div className="size-14 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-3">
                <RotateCcw className="size-6 text-amber-500" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Review Session</h1>
              <p className="text-sm text-muted-foreground">
                Tap up to 3 concepts to review, or tell {tutor.name} what you want to work on.
              </p>
            </div>
          </motion.div>

          {reviewConcepts.length > 0 ? (
            <>
              {/* Needs Work group */}
              {reviewConcepts.filter((c: any) => c.masteryScore < 0.7).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-amber-500 mb-2 flex items-center gap-1.5">
                    <Target className="size-3" /> Needs Work
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {reviewConcepts.filter((c: any) => c.masteryScore < 0.7).map((c: any, i: number) => {
                      const isSelected = selectedReviewConcepts.includes(c.conceptId);
                      const pct = Math.round(c.masteryScore * 100);
                      const name = c.conceptId.replace(/^(grammar\.|vocab\.)/, "").replace(/_/g, " ");
                      const lastDate = c.lastPracticed ? new Date(c.lastPracticed).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never";
                      return (
                        <motion.div key={c.conceptId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}>
                          <button onClick={() => toggleConcept(c.conceptId)} className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${isSelected ? "border-amber-500 bg-amber-500/10 shadow-md shadow-amber-500/10" : "border-border/60 bg-card hover:border-amber-500/40 hover:bg-amber-500/5"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`size-6 rounded-md flex items-center justify-center ${c.conceptId.startsWith("grammar.") ? "bg-amber-500/15" : "bg-blue-500/15"}`}>
                                {c.conceptId.startsWith("grammar.") ? <Brain className="size-3 text-amber-500" /> : <BookOpen className="size-3 text-blue-500" />}
                              </div>
                              <span className="text-sm font-semibold capitalize truncate flex-1">{name}</span>
                              {isSelected && <Target className="size-4 text-amber-500 shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className={pct < 30 ? "text-red-500 font-medium" : pct < 50 ? "text-amber-500 font-medium" : ""}>{pct}% confidence</span>
                              <span>Last: {lastDate}</span>
                            </div>
                            <Progress value={pct} className="h-1 mt-1.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Due for Refresh group */}
              {reviewConcepts.filter((c: any) => c.masteryScore >= 0.7).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-green-500 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="size-3" /> Due for Refresh
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {reviewConcepts.filter((c: any) => c.masteryScore >= 0.7).map((c: any, i: number) => {
                      const isSelected = selectedReviewConcepts.includes(c.conceptId);
                      const pct = Math.round(c.masteryScore * 100);
                      const name = c.conceptId.replace(/^(grammar\.|vocab\.)/, "").replace(/_/g, " ");
                      const lastDate = c.lastPracticed ? new Date(c.lastPracticed).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never";
                      return (
                        <motion.div key={c.conceptId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, duration: 0.3 }}>
                          <button onClick={() => toggleConcept(c.conceptId)} className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${isSelected ? "border-green-500 bg-green-500/10 shadow-md shadow-green-500/10" : "border-border/60 bg-card hover:border-green-500/40 hover:bg-green-500/5"}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <div className={`size-6 rounded-md flex items-center justify-center ${c.conceptId.startsWith("grammar.") ? "bg-amber-500/15" : "bg-blue-500/15"}`}>
                                {c.conceptId.startsWith("grammar.") ? <Brain className="size-3 text-amber-500" /> : <BookOpen className="size-3 text-blue-500" />}
                              </div>
                              <span className="text-sm font-semibold capitalize truncate flex-1">{name}</span>
                              {isSelected && <CheckCircle2 className="size-4 text-green-500 shrink-0" />}
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span className="text-green-500 font-medium">{pct}% confident</span>
                              <span>Last: {lastDate}</span>
                            </div>
                            <Progress value={pct} className="h-1 mt-1.5" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <Card className="mb-4">
              <CardContent className="p-5 text-center">
                <Sparkles className="size-8 text-amber-500/40 mx-auto mb-2" />
                <p className="text-sm font-medium mb-1">No concepts to review yet</p>
                <p className="text-xs text-muted-foreground">
                  Complete a few lessons first, then come back to strengthen what you've learned.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            <div className="relative">
              <Input
                value={reviewFreeText}
                onChange={(e) => setReviewFreeText(e.target.value)}
                placeholder={`Or tell ${tutor.name} what you want to work on...`}
                className="pr-4"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setReviewPickerOpen(false);
                  setSelectedReviewConcepts([]);
                  setReviewFreeText("");
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={startReviewSession}
                disabled={selectedReviewConcepts.length === 0 && !reviewFreeText.trim()}
              >
                Start Review
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Topic picker for free conversation
  if (topicPickerOpen) {
    return (
      <Layout>
        <SEO title="Pick a Topic — Lingua" />
        <div className="max-w-lg mx-auto px-4 py-8 sm:py-12">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="text-center mb-6">
              <div className="size-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
                <MessageCircle className="size-6 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Pick a Topic</h1>
              <p className="text-sm text-muted-foreground">
                What would you like to chat about with {tutor.name}?
              </p>
            </div>
          </motion.div>

          <div className="grid grid-cols-2 gap-2.5 mb-4">
            {CONVERSATION_TOPICS.map((t, i) => {
              const isSelected = selectedTopic === t.id;
              const Icon = t.icon;
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 + i * 0.04, duration: 0.3 }}
                >
                  <button
                    onClick={() => { setSelectedTopic(isSelected ? null : t.id); setCustomTopic(""); }}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                      isSelected
                        ? "border-emerald-500 bg-emerald-500/10 shadow-md shadow-emerald-500/10"
                        : "border-border/60 bg-card hover:border-emerald-500/40 hover:bg-emerald-500/5"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`size-7 rounded-lg flex items-center justify-center ${isSelected ? "bg-emerald-500/20" : "bg-muted/50"}`}>
                        <Icon className={`size-3.5 ${isSelected ? "text-emerald-500" : "text-muted-foreground"}`} />
                      </div>
                      <span className="text-sm font-semibold">{t.label}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground pl-9">{t.desc}</p>
                  </button>
                </motion.div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="relative">
              <Input
                value={customTopic}
                onChange={(e) => { setCustomTopic(e.target.value); if (e.target.value) setSelectedTopic(null); }}
                placeholder={`Or type your own topic...`}
                className="pr-4"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setTopicPickerOpen(false);
                  setSelectedTopic(null);
                  setCustomTopic("");
                }}
              >
                Back
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={confirmTopicAndContinue}
                disabled={!selectedTopic && !customTopic.trim()}
              >
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Active chat session (either resumed or lazily created)
  if (activeSession || pendingSessionType) {
    return (
      <Layout hideBottomNav>
        <SEO title="Practice — Lingua" />
        <div className="h-[calc(100dvh-4rem)] flex flex-col">
          {isAnalyzing && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="size-12 rounded-full border-4 border-primary/20 border-t-primary mb-4"
              />
              <p className="text-sm font-medium">Analyzing your session...</p>
              <p className="text-xs text-muted-foreground mt-1">Calculating your progress</p>
            </motion.div>
          )}
          {isWrappingUp && !isAnalyzing && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-violet-500/15 backdrop-blur-md border border-violet-500/25 rounded-full px-5 py-2.5 shadow-lg shadow-violet-500/10"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="size-2 rounded-full bg-violet-500"
              />
              <span className="text-sm font-medium text-violet-600 dark:text-violet-400">
                Wrapping up your session...
              </span>
            </motion.div>
          )}
          <ChatInterface
            sessionId={activeSession || undefined}
            pendingSessionType={pendingSessionType || undefined}
            onSessionCreated={handleSessionCreated}
            initialMessages={initialMessages}
            onSessionEnd={handleSessionEnd}
            onSessionComplete={handleSessionComplete}
            targetLanguage={session?.user?.targetLanguage || "fr"}
            conversationTopic={conversationTopic || undefined}
          />
        </div>
      </Layout>
    );
  }

  // Session type picker
  return (
    <Layout>
      <SEO title="Practice — Lingua" />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center mb-6"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ReactCountryFlag
                countryCode={tutor.countryCode}
                svg
                style={{ width: "1.75rem", height: "1.75rem" }}
                className="rounded"
              />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">
            Practice with {tutor.name}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Choose how you&apos;d like to practice {tutor.language} today
          </p>
        </motion.div>

        {/* Current Level & Curriculum Preview */}
        {stats && curriculum && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05, duration: 0.4 }}
            className="mb-5"
          >
            <Card className="border-primary/10 bg-gradient-to-br from-primary/3 to-primary/8">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="font-bold text-xs">
                      {stats.currentLevel}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {curriculum.label}
                    </span>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {stats.conceptsMastered}/{stats.totalConceptsInLevel} concepts
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {curriculum.description}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {curriculum.grammarConcepts.slice(0, 3).map((g) => (
                    <span
                      key={g.conceptId}
                      className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full px-2 py-0.5"
                    >
                      <Brain className="size-2.5" />
                      {g.name}
                    </span>
                  ))}
                  {curriculum.vocabularyClusters.slice(0, 2).map((v) => (
                    <span
                      key={v.conceptId}
                      className="inline-flex items-center gap-1 text-[10px] bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-full px-2 py-0.5"
                    >
                      <BookOpen className="size-2.5" />
                      {v.name}
                    </span>
                  ))}
                  {(curriculum.grammarConcepts.length - 3 + curriculum.vocabularyClusters.length - 2) > 0 && (
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                      +{Math.max(0, curriculum.grammarConcepts.length - 3) + Math.max(0, curriculum.vocabularyClusters.length - 2)} more
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Voice Chat Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="mb-5"
        >
          <Card className="border-rose-500/15 bg-gradient-to-r from-rose-500/5 to-violet-500/5 overflow-hidden">
            <CardContent className="p-3.5 flex items-center gap-3">
              <div className="size-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-violet-500/20 flex items-center justify-center shrink-0">
                <Mic className="size-5 text-rose-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold flex items-center gap-1.5">
                  Voice Chat Available
                  <Badge className="bg-rose-500/10 text-rose-500 border-rose-500/20 text-[9px] px-1.5 py-0">
                    All Modes
                  </Badge>
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Use the <Mic className="size-2.5 inline" /> mic button to speak, and tap <Volume2 className="size-2.5 inline" /> to hear {tutor.name} respond aloud
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Session Type Cards */}
        <div className="grid gap-3 sm:gap-4">
          {SESSION_TYPES.map(({ type, label, description, detail, icon, color, bgColor, gradient, features }, i) => {
            const isExpanded = expandedType === type;
            return (
              <motion.div
                key={type}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.1, duration: 0.4 }}
              >
                <Card
                  className={`group transition-all duration-300 hover:shadow-lg border-transparent hover:border-primary/20 bg-gradient-to-r ${gradient} overflow-hidden relative`}
                >
                  <div className="absolute top-0 right-0 size-24 bg-primary/5 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                  <CardContent className="relative p-0">
                    {/* Main clickable area */}
                    <div
                      className="flex items-center gap-4 p-5 cursor-pointer"
                      onClick={() => startSession(type)}
                    >
                      <div
                        className={`size-14 rounded-2xl ${bgColor} flex items-center justify-center shrink-0 ${color} group-hover:scale-105 transition-transform duration-300`}
                      >
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{label}</CardTitle>
                          {type === "LESSON" && (
                            <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] px-1.5">
                              <Zap className="size-2.5 mr-0.5" />
                              Recommended
                            </Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs sm:text-sm">{description}</CardDescription>
                        {/* Feature pills */}
                        <div className="flex items-center flex-wrap gap-1.5 mt-2">
                          {features.map((f, fi) => (
                            <span
                              key={fi}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-background/60 rounded-full px-2 py-0.5 border border-border/50"
                            >
                              {f.icon}
                              {f.label}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="size-8 rounded-full bg-background/80 flex items-center justify-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="size-4 text-primary" />
                      </div>
                    </div>

                    {/* Expand/collapse detail */}
                    <div className="px-5 pb-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedType(isExpanded ? null : type);
                        }}
                        className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors mb-2"
                      >
                        {isExpanded ? "Less detail" : "How it works"}
                        {isExpanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          className="overflow-hidden"
                        >
                          <div className="px-5 pb-4 pt-0 border-t border-border/30">
                            <p className="text-xs text-muted-foreground leading-relaxed mt-3">
                              {detail}
                            </p>
                            {type === "LESSON" && curriculum && (
                              <div className="mt-3 space-y-2">
                                <p className="text-[11px] font-medium text-foreground/70">
                                  Upcoming topics at your level:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {curriculum.grammarConcepts.slice(0, 4).map((g) => (
                                    <span
                                      key={g.conceptId}
                                      className="text-[10px] bg-muted/50 rounded px-2 py-0.5"
                                    >
                                      {g.name}
                                    </span>
                                  ))}
                                  {curriculum.vocabularyClusters.slice(0, 3).map((v) => (
                                    <span
                                      key={v.conceptId}
                                      className="text-[10px] bg-muted/50 rounded px-2 py-0.5"
                                    >
                                      {v.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Voice & Skills Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 space-y-3"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { icon: <Eye className="size-3.5" />, label: "Reading", color: "text-green-500", bg: "bg-green-500/10", active: true },
              { icon: <PenTool className="size-3.5" />, label: "Writing", color: "text-indigo-500", bg: "bg-indigo-500/10", active: true },
              { icon: <Mic className="size-3.5" />, label: "Speaking", color: "text-rose-500", bg: "bg-rose-500/10", active: false },
              { icon: <Headphones className="size-3.5" />, label: "Listening", color: "text-cyan-500", bg: "bg-cyan-500/10", active: false },
            ].map((skill) => (
              <div key={skill.label} className={`flex flex-col items-center gap-1 py-2 rounded-lg ${!skill.active ? "opacity-50" : ""}`}>
                <div className={`size-8 rounded-lg ${skill.bg} flex items-center justify-center relative`}>
                  <span className={skill.color}>{skill.icon}</span>
                  {!skill.active && (
                    <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-muted flex items-center justify-center ring-1 ring-background">
                      <Lock className="size-2 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-medium">{skill.label}</span>
                {!skill.active && (
                  <span className="text-[8px] text-muted-foreground/70">Voice Mode</span>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1.5">
            <Sparkles className="size-3" />
            Reading & Writing tracked automatically — Speaking & Listening available in Voice Mode
          </p>
        </motion.div>
      </div>
    </Layout>
  );
}
