import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import Card from "@/components/ui/Card";
import { cefrLabel } from "@/lib/utils";

interface ProgressData {
  profile: any;
  masteries: Array<{
    conceptId: string;
    conceptType: string;
    masteryScore: number;
    practiceCount: number;
    lastPracticed: string;
  }>;
  stats: {
    totalSessions: number;
    totalMessages: number;
    currentStreak: number;
    conceptsMastered: number;
    totalConceptsInLevel: number;
    levelProgress: number;
  };
  levelHistory: Array<{
    fromLevel: string;
    toLevel: string;
    reason: string;
    changedAt: string;
  }>;
}

export default function ProgressPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) fetchProgress();
  }, [session]);

  async function fetchProgress() {
    try {
      const res = await fetch("/api/progress");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  if (status === "loading" || loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!session || !data?.profile) return null;

  const filteredMasteries =
    filter === "all"
      ? data.masteries
      : data.masteries.filter((m) => m.conceptType === filter);

  const conceptTypeColors: Record<string, string> = {
    GRAMMAR: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    VOCABULARY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    PRONUNCIATION: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    CULTURE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    PRAGMATICS: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  };

  function masteryColor(score: number) {
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.5) return "bg-yellow-500";
    if (score >= 0.3) return "bg-orange-500";
    return "bg-red-500";
  }

  return (
    <Layout>
      <SEO title="Progress" />
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Progress
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Track your French learning journey
        </p>

        {/* Skill Radar */}
        <Card padding="lg" className="mb-8">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Skill Overview — {cefrLabel(data.profile.currentLevel)}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Comprehension", value: data.profile.comprehensionScore },
              { label: "Vocabulary", value: data.profile.vocabularyScore },
              { label: "Grammar", value: data.profile.grammarScore },
              { label: "Fluency", value: data.profile.fluencyScore },
            ].map((skill) => (
              <div key={skill.label} className="text-center">
                <div className="relative w-20 h-20 mx-auto mb-2">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      className="text-gray-200 dark:text-gray-700"
                      strokeWidth="3"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="currentColor"
                      className="text-indigo-600"
                      strokeWidth="3"
                      strokeDasharray={`${(skill.value || 0) * 100}, 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-800 dark:text-gray-200">
                    {Math.round((skill.value || 0) * 100)}%
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {skill.label}
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Level Progress */}
        <Card padding="lg" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Level Progress
            </h2>
            <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
              {data.stats.levelProgress}%
            </span>
          </div>
          <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${data.stats.levelProgress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {data.stats.conceptsMastered} of {data.stats.totalConceptsInLevel}{" "}
            concepts mastered at {data.profile.currentLevel}
          </p>
        </Card>

        {/* Concept Masteries */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Concept Mastery
            </h2>
            <div className="flex gap-2">
              {["all", "GRAMMAR", "VOCABULARY", "CULTURE"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`text-xs px-3 py-1 rounded-full transition-colors ${
                    filter === f
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                  }`}
                >
                  {f === "all" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {filteredMasteries.length === 0 ? (
            <Card padding="lg">
              <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                No concepts practiced yet. Start a session to build your skills!
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredMasteries.map((m) => (
                <Card key={m.conceptId} padding="sm">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${masteryColor(m.masteryScore)}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                          {m.conceptId.replace(/\./g, " › ")}
                        </p>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${conceptTypeColors[m.conceptType] || "bg-gray-100 text-gray-600"}`}
                        >
                          {m.conceptType}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${masteryColor(m.masteryScore)}`}
                            style={{ width: `${m.masteryScore * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">
                          {Math.round(m.masteryScore * 100)}%
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        ×{m.practiceCount}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Level History */}
        {data.levelHistory.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
              Level History
            </h2>
            <div className="space-y-3">
              {data.levelHistory.map((h, i) => (
                <Card key={i} padding="sm">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1 text-sm">
                      <span className="font-medium text-gray-600 dark:text-gray-400">
                        {h.fromLevel}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        {h.toLevel}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex-1 truncate">
                      {h.reason}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                      {new Date(h.changedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
