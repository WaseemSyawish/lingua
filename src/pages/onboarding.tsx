import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "motion/react";
import ReactCountryFlag from "react-country-flag";
import SEO from "@/components/SEO";
import ChatInterface from "@/components/chat/ChatInterface";
import { getTutorConfig, getAllTutorConfigs } from "@/curriculum/prompts/base-persona";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { cefrLabel } from "@/lib/utils";
import {
  ArrowRight,
  SkipForward,
  Loader2,
  BookOpen,
  MessageCircle,
  Brain,
  Sparkles,
  CheckCircle,
  Globe,
  Star,
} from "lucide-react";
import { LinguaLogo } from "@/components/LinguaLogo";

type Step = "language" | "welcome" | "placement" | "analyzing" | "results";

interface PlacementResult {
  level: string;
  skills: {
    comprehensionScore: number;
    vocabularyScore: number;
    grammarScore: number;
    fluencyScore: number;
    overallConfidence: number;
  };
  analysis?: {
    reasoning?: string;
    strengths?: string[];
    areasToImprove?: string[];
  };
}

const LANGUAGE_OPTIONS = Object.entries(getAllTutorConfigs()).map(([code, config]) => ({
  code,
  name: config.language,
  flag: config.flag,
  countryCode: config.countryCode,
  tutor: config.name,
  greeting: config.greeting,
}));

export default function OnboardingPage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const [step, setStep] = useState<Step>("language");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("fr");
  const [placementSessionId, setPlacementSessionId] = useState<string | null>(
    null
  );
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/auth/signin");
  }, [status, router]);

  // Animate analysis steps
  useEffect(() => {
    if (step !== "analyzing") return;
    const steps = [0, 1, 2, 3];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < steps.length) {
        setAnalysisStep(i);
      } else {
        clearInterval(interval);
      }
    }, 800);
    return () => clearInterval(interval);
  }, [step]);

  const tutor = getTutorConfig(selectedLanguage);

  const handleLanguageSelect = async (langCode: string) => {
    setSelectedLanguage(langCode);
    try {
      await fetch("/api/user/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetLanguage: langCode }),
      });
      await update(); // refresh the session to include new targetLanguage
    } catch (err) {
      console.error("Failed to set language:", err);
    }
    setStep("welcome");
  };

  const startPlacement = async () => {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: "PLACEMENT" }),
      });
      if (!res.ok) throw new Error("Failed to create placement session");
      const data = await res.json();
      setPlacementSessionId(data.session?.id || data.id);
      setStep("placement");
    } catch (err) {
      console.error("Failed to start placement:", err);
    }
  };

  const handlePlacementComplete = async () => {
    if (!placementSessionId || analyzing) return;
    setAnalyzing(true);

    // Wait 2.5s so the user can read Amélie's final message before transitioning
    await new Promise((resolve) => setTimeout(resolve, 2500));
    setStep("analyzing");

    try {
      const res = await fetch("/api/placement/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: placementSessionId }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      setResult(data);
      setStep("results");

      await update();
    } catch (err) {
      console.error("Placement analysis failed:", err);
      await update();
      router.replace("/dashboard");
    } finally {
      setAnalyzing(false);
    }
  };

  const skipPlacement = async () => {
    try {
      await fetch("/api/placement/skip", { method: "POST" });
      await update();
    } catch (err) {
      console.error("Skip failed:", err);
    }
    router.replace("/dashboard");
  };

  if (status === "loading") return null;

  const userName = session?.user?.name?.split(" ")[0] || "there";

  return (
    <>
      <SEO title="Get Started — Lingua" />
      <div className="min-h-screen bg-background">
        {/* Minimal top bar */}
        <div className="border-b bg-background/80 backdrop-blur">
          <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="size-7 rounded-lg bg-primary flex items-center justify-center">
                <LinguaLogo className="size-3.5 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg">Lingua</span>
            </div>
            {step === "welcome" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={skipPlacement}
                className="text-muted-foreground text-xs"
              >
                <SkipForward className="size-3.5 mr-1.5" />
                Skip to beginner
              </Button>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="max-w-md mx-auto px-4 pt-6">
          <div className="flex items-center gap-2">
            {["Language", "Welcome", "Assessment", "Results"].map((label, i) => {
              const stepIndex = step === "language" ? 0 : step === "welcome" ? 1 : step === "placement" ? 2 : step === "analyzing" ? 2 : 3;
              return (
                <React.Fragment key={label}>
                  <div className="flex items-center gap-2 flex-1">
                    <div
                      className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                        i <= stepIndex ? "bg-primary" : "bg-muted"
                      }`}
                    />
                  </div>
                </React.Fragment>
              );
            })}
          </div>
          <div className="flex justify-between mt-2 text-[11px] text-muted-foreground px-1">
            <span>Language</span>
            <span>Welcome</span>
            <span>Assessment</span>
            <span>Results</span>
          </div>
        </div>

        {/* Main content */}
        <div className="flex items-center justify-center px-4 py-8 min-h-[calc(100vh-8rem)]">
          <AnimatePresence mode="wait">
            {step === "language" && (
              <motion.div
                key="language"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="max-w-lg w-full"
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                    className="size-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center"
                  >
                    <Globe className="size-9 text-primary" />
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-bold mb-3"
                  >
                    What would you like to learn?
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground text-lg"
                  >
                    Choose your language — you&apos;ll get a dedicated AI tutor.
                  </motion.p>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="grid gap-3"
                >
                  {LANGUAGE_OPTIONS.map((lang, i) => (
                    <motion.button
                      key={lang.code}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      onClick={() => handleLanguageSelect(lang.code)}
                      className="flex items-center gap-4 p-5 bg-card border rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
                    >
                      <ReactCountryFlag countryCode={lang.countryCode} svg style={{ width: "2.5rem", height: "2.5rem" }} className="rounded" />
                      <div className="flex-1">
                        <p className="font-semibold text-lg group-hover:text-primary transition-colors">
                          {lang.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Learn with {lang.tutor} — &ldquo;{lang.greeting}!&rdquo;
                        </p>
                      </div>
                      <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </motion.button>
                  ))}
                </motion.div>
              </motion.div>
            )}

            {step === "welcome" && (
              <motion.div
                key="welcome"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
                className="max-w-lg w-full"
              >
                <div className="text-center mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, type: "spring", stiffness: 200, damping: 15 }}
                    className="size-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center"
                  >
                    <span className="text-5xl">
                      <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "3rem", height: "3rem" }} className="rounded" />
                    </span>
                  </motion.div>
                  <motion.h1
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="text-3xl font-bold mb-3"
                  >
                    {tutor.greeting}, {userName}!
                  </motion.h1>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground text-lg"
                  >
                    Let&apos;s find your {tutor.language} level with a quick chat.
                  </motion.p>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="text-muted-foreground/70 text-sm mt-2"
                  >
                    {tutor.name} will ask you a few questions in {tutor.language} &mdash; just reply however you can. No pressure!
                  </motion.p>
                </div>

                {/* Feature cards */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8"
                >
                  {[
                    { icon: <MessageCircle className="size-5" />, title: "Quick Chat", description: `~8-10 messages with ${tutor.name}` },
                    { icon: <Brain className="size-5" />, title: "Smart Analysis", description: "AI evaluates your level" },
                    { icon: <Sparkles className="size-5" />, title: "Personalized", description: "Tailored learning path" },
                  ].map((f, i) => (
                    <motion.div
                      key={f.title}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 + i * 0.1 }}
                      className="bg-card border rounded-xl p-4 text-center"
                    >
                      <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mx-auto mb-2.5">
                        {f.icon}
                      </div>
                      <p className="text-xs font-medium mb-0.5">{f.title}</p>
                      <p className="text-[11px] text-muted-foreground">{f.description}</p>
                    </motion.div>
                  ))}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7 }}
                  className="space-y-3"
                >
                  <Button
                    className="w-full h-12 rounded-xl text-base font-medium shadow-lg shadow-primary/20"
                    size="lg"
                    onClick={startPlacement}
                  >
                    Chat with {tutor.name}
                    <ArrowRight className="size-4 ml-2" />
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    About 2-3 minutes &middot; ~8-10 messages &middot; Just chat naturally!
                  </p>
                </motion.div>
              </motion.div>
            )}

            {step === "placement" && placementSessionId && (
              <motion.div
                key="placement"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="w-full max-w-3xl h-[70vh]"
              >
                <Card className="h-full flex flex-col overflow-hidden border-0 shadow-2xl shadow-black/5">
                  <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
                    <ChatInterface
                      sessionId={placementSessionId}
                      isPlacement
                      onPlacementComplete={handlePlacementComplete}
                      targetLanguage={selectedLanguage}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "analyzing" && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="max-w-sm w-full"
              >
                <Card className="border-0 shadow-2xl shadow-black/5">
                  <CardContent className="p-8 text-center">
                    <div className="relative size-16 mx-auto mb-6">
                      <div className="absolute inset-0 rounded-full border-4 border-muted" />
                      <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                      <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                        <Brain className="size-5 text-primary" />
                      </div>
                    </div>
                    <h2 className="text-xl font-bold mb-3">
                      Analyzing your {tutor.language}...
                    </h2>
                    <div className="space-y-3 text-left mb-6">
                      {[
                        "Reading conversation context",
                        "Evaluating grammar & vocabulary",
                        "Assessing fluency patterns",
                        "Determining CEFR level",
                      ].map((label, i) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0.4 }}
                          animate={{ opacity: i <= analysisStep ? 1 : 0.4 }}
                          className="flex items-center gap-3 text-sm"
                        >
                          {i <= analysisStep ? (
                            <CheckCircle className="size-4 text-primary flex-shrink-0" />
                          ) : (
                            <div className="size-4 rounded-full border-2 border-muted flex-shrink-0" />
                          )}
                          <span className={i <= analysisStep ? "text-foreground" : "text-muted-foreground"}>
                            {label}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                    <Progress value={(analysisStep + 1) * 25} className="h-2" />
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === "results" && result && (
              <motion.div
                key="results"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-lg w-full"
              >
                <Card className="border-0 shadow-2xl shadow-black/5 overflow-hidden">
                  {/* Celebration header */}
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center relative">
                    <div className="absolute top-4 left-4 text-2xl opacity-20">🎉</div>
                    <div className="absolute top-6 right-6 text-xl opacity-20">✨</div>
                    <div className="absolute bottom-4 left-8 opacity-20">
                      <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "1.5rem", height: "1.5rem" }} />
                    </div>
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, damping: 12 }}
                      className="size-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center"
                    >
                      <CheckCircle className="size-8 text-emerald-500" />
                    </motion.div>
                    <h2 className="text-2xl font-bold mb-1">
                      Assessment Complete!
                    </h2>
                    <p className="text-muted-foreground">
                      Here&apos;s your personalized profile
                    </p>
                  </div>

                  <CardContent className="p-8">
                    {/* Level badge */}
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="flex justify-center mb-8"
                    >
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-2xl px-8 py-4 text-center">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Level</p>
                        <p className="text-4xl font-bold text-primary">
                          {result.level.toUpperCase()}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {cefrLabel(result.level as any)}
                        </p>
                      </div>
                    </motion.div>

                    {/* Skills */}
                    <div className="space-y-4 mb-8">
                      {[
                        {
                          label: "Comprehension",
                          value: result.skills?.comprehensionScore ?? 0,
                          icon: <Brain className="size-4" />,
                          color: "bg-blue-500",
                        },
                        {
                          label: "Vocabulary",
                          value: result.skills?.vocabularyScore ?? 0,
                          icon: <BookOpen className="size-4" />,
                          color: "bg-emerald-500",
                        },
                        {
                          label: "Grammar",
                          value: result.skills?.grammarScore ?? 0,
                          icon: <Sparkles className="size-4" />,
                          color: "bg-violet-500",
                        },
                        {
                          label: "Fluency",
                          value: result.skills?.fluencyScore ?? 0,
                          icon: <MessageCircle className="size-4" />,
                          color: "bg-amber-500",
                        },
                      ].map(({ label, value, icon, color }, i) => (
                        <motion.div
                          key={label}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.1 }}
                        >
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="flex items-center gap-2 text-muted-foreground">
                              {icon}
                              {label}
                            </span>
                            <span className="font-semibold">
                              {Math.round((value ?? 0) * 100)}%
                            </span>
                          </div>
                          <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${(value ?? 0) * 100}%` }}
                              transition={{ delay: 0.5 + i * 0.1, duration: 0.8, ease: "easeOut" }}
                              className={`h-full rounded-full ${color}`}
                            />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Strengths */}
                    {result.analysis?.strengths && result.analysis.strengths.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.8 }}
                        className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-4 mb-6"
                      >
                        <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                          <Star className="size-3.5" />
                          Your Strengths
                        </p>
                        <ul className="space-y-1">
                          {result.analysis.strengths.slice(0, 3).map((s, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="size-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1 }}
                    >
                      <Button
                        className="w-full h-12 rounded-xl text-base font-medium"
                        size="lg"
                        onClick={() => router.push("/dashboard")}
                      >
                        Start Learning
                        <ArrowRight className="size-4 ml-2" />
                      </Button>
                      <p className="text-center text-xs text-muted-foreground mt-3">
                        Your personalized curriculum is ready!
                      </p>
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </>
  );
}
