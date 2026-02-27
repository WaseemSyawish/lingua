import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "motion/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import ChatInterface from "@/components/chat/ChatInterface";
import Button from "@/components/ui/Button";
import { SessionType } from "@/generated/prisma/enums";

type OnboardingStep = "welcome" | "placement" | "analyzing" | "results";

interface PlacementResult {
  level: string;
  analysis: {
    confidence: number;
    comprehension: number;
    vocabulary: number;
    grammar: number;
    fluency: number;
    culturalAwareness: number;
    reasoning: string;
    strengths: string[];
    areasToImprove: string[];
  };
}

export default function OnboardingPage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [step, setStep] = useState<OnboardingStep>("welcome");
  const [placementSessionId, setPlacementSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<PlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [skipLoading, setSkipLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <Layout showNav={false}>
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  async function startPlacement() {
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: SessionType.PLACEMENT }),
      });

      if (!res.ok) throw new Error("Failed to create placement session");

      const data = await res.json();
      setPlacementSessionId(data.session.id);
      setStep("placement");
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleEndPlacement() {
    if (!placementSessionId) return;

    setStep("analyzing");
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/placement/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: placementSessionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Analysis failed");
      }

      const data: PlacementResult = await res.json();
      setResult(data);
      setStep("results");

      // Update session to reflect new level
      await update();
    } catch (err: any) {
      setError(err.message);
      setStep("placement"); // Go back to placement
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function skipPlacement() {
    setSkipLoading(true);
    try {
      // Create a default skill profile at A0
      const res = await fetch("/api/placement/skip", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to skip placement");

      await update();
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSkipLoading(false);
    }
  }

  function goToDashboard() {
    router.push("/dashboard");
  }

  const cefrLabels: Record<string, string> = {
    A0: "Complete Beginner",
    A1: "Beginner",
    A2: "Elementary",
    B1: "Intermediate",
    B2: "Upper Intermediate",
    C1: "Advanced",
    C2: "Mastery",
  };

  return (
    <Layout showNav={false}>
      <SEO title="Welcome" noIndex={true} />
      <AnimatePresence mode="wait">
        {/* Welcome Step */}
        {step === "welcome" && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center px-4"
          >
            <div className="max-w-lg text-center">
              <div className="text-6xl mb-6">🇫🇷</div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Bienvenue!
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">
                Welcome to Lingua
              </p>
              <p className="text-gray-500 dark:text-gray-400 mb-8">
                Let&apos;s find out your French level so Amélie, your AI tutor, can
                personalize your learning experience.
              </p>

              {error && (
                <div className="mb-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="space-y-3">
                <Button onClick={startPlacement} size="lg" className="w-full">
                  Start Placement Chat
                </Button>
                <Button
                  onClick={skipPlacement}
                  variant="ghost"
                  size="lg"
                  className="w-full"
                  loading={skipLoading}
                >
                  Skip — Start as Complete Beginner
                </Button>
              </div>

              <p className="text-xs text-gray-400 dark:text-gray-600 mt-6">
                The placement takes 3-5 minutes. It&apos;s a friendly chat, not a test!
              </p>
            </div>
          </motion.div>
        )}

        {/* Placement Chat Step */}
        {step === "placement" && placementSessionId && (
          <motion.div
            key="placement"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-screen flex flex-col"
          >
            <div className="bg-indigo-600 text-white px-4 py-2 text-center text-sm">
              Placement Assessment — Chat naturally with Amélie. When you&apos;re
              done, click &quot;Finish Assessment&quot; below.
            </div>
            <div className="flex-1">
              <ChatInterface
                sessionId={placementSessionId}
                onSessionEnd={handleEndPlacement}
              />
            </div>
          </motion.div>
        )}

        {/* Analyzing Step */}
        {step === "analyzing" && (
          <motion.div
            key="analyzing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="min-h-screen flex items-center justify-center px-4"
          >
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-6 relative">
                <div className="absolute inset-0 border-4 border-indigo-200 dark:border-indigo-800 rounded-full" />
                <div className="absolute inset-0 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Analyzing your French...
              </h2>
              <p className="text-gray-500 dark:text-gray-400">
                Amélie is evaluating your conversation to find the perfect level
                for you.
              </p>
            </div>
          </motion.div>
        )}

        {/* Results Step */}
        {step === "results" && result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="min-h-screen flex items-center justify-center px-4 py-12"
          >
            <div className="max-w-lg w-full">
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🎉</div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Your Level: {result.level}
                </h2>
                <p className="text-lg text-indigo-600 dark:text-indigo-400">
                  {cefrLabels[result.level] || result.level}
                </p>
              </div>

              {/* Scores */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4">
                  Skill Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Comprehension", value: result.analysis.comprehension },
                    { label: "Vocabulary", value: result.analysis.vocabulary },
                    { label: "Grammar", value: result.analysis.grammar },
                    { label: "Fluency", value: result.analysis.fluency },
                    { label: "Cultural Awareness", value: result.analysis.culturalAwareness },
                  ].map((skill) => (
                    <div key={skill.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-600 dark:text-gray-400">
                          {skill.label}
                        </span>
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {Math.round((skill.value || 0) * 100)}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(skill.value || 0) * 100}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-full bg-indigo-600 rounded-full"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Analysis */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {result.analysis.reasoning}
                </p>

                {result.analysis.strengths.length > 0 && (
                  <div className="mb-3">
                    <h4 className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wider mb-1">
                      Strengths
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {result.analysis.strengths.map((s, i) => (
                        <li key={i}>✓ {s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.analysis.areasToImprove.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                      Areas to Improve
                    </h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      {result.analysis.areasToImprove.map((a, i) => (
                        <li key={i}>→ {a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <Button onClick={goToDashboard} size="lg" className="w-full">
                Start Learning! →
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
