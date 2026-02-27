import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { cefrLabel } from "@/lib/utils";

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
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session?.user) {
      fetchDashboard();
    }
  }, [session]);

  async function fetchDashboard() {
    try {
      const res = await fetch("/api/progress");
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch {
      // Silently fail
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

  if (!session) return null;

  // If no profile, redirect to onboarding
  if (!loading && data && !data.profile) {
    router.push("/onboarding");
    return null;
  }

  const stats = data?.stats;
  const profile = data?.profile;

  return (
    <Layout>
      <SEO title="Dashboard" />
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Bonjour, {session.user?.name?.split(" ")[0] || "there"}! 👋
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {profile
              ? `You're currently at ${cefrLabel(profile.currentLevel)}`
              : "Ready to start learning?"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card padding="md">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats?.currentStreak || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Day Streak 🔥
              </p>
            </div>
          </Card>
          <Card padding="md">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats?.totalSessions || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Sessions
              </p>
            </div>
          </Card>
          <Card padding="md">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats?.totalMessages || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Messages
              </p>
            </div>
          </Card>
          <Card padding="md">
            <div className="text-center">
              <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                {stats?.conceptsMastered || 0}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Concepts Mastered
              </p>
            </div>
          </Card>
        </div>

        {/* Level Progress */}
        {profile && (
          <Card padding="lg" className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Level Progress — {profile.currentLevel}
              </h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {stats?.conceptsMastered || 0}/{stats?.totalConceptsInLevel || 0}{" "}
                concepts
              </span>
            </div>
            <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${stats?.levelProgress || 0}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {stats?.levelProgress || 0}% mastered — Master 60% of concepts to
              advance to the next level
            </p>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={() => router.push("/practice")}
            className="p-6 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-white text-left transition-colors"
          >
            <h3 className="text-xl font-bold mb-1">Start Practicing</h3>
            <p className="text-indigo-200 text-sm">
              Chat with Amélie and improve your French
            </p>
          </button>
          <button
            onClick={() => router.push("/progress")}
            className="p-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-left transition-colors"
          >
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200 mb-1">
              View Progress
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              See your skills breakdown and learning journey
            </p>
          </button>
        </div>

        {/* Recent Sessions */}
        {data?.recentSessions && data.recentSessions.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Recent Sessions
              </h2>
              <button
                onClick={() => router.push("/history")}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View all →
              </button>
            </div>
            <div className="space-y-3">
              {data.recentSessions.slice(0, 5).map((s) => (
                <Card key={s.id} padding="md">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Session #{s.sessionNumber} —{" "}
                        {s.sessionType.replace(/_/g, " ").toLowerCase()}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {new Date(s.startedAt).toLocaleDateString()} ·{" "}
                        {s.messageCount} messages
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        s.endedAt
                          ? router.push(`/history/${s.id}`)
                          : router.push(`/practice?sessionId=${s.id}`)
                      }
                      className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {s.endedAt ? "Review" : "Continue →"}
                    </button>
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
