import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import Card from "@/components/ui/Card";

interface SessionListItem {
  id: string;
  sessionNumber: number;
  sessionType: string;
  messageCount: number;
  startedAt: string;
  endedAt: string | null;
}

export default function HistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user) fetchSessions();
  }, [session]);

  async function fetchSessions() {
    try {
      const res = await fetch("/api/sessions");
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
      }
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

  const sessionTypeIcons: Record<string, string> = {
    LESSON: "📚",
    FREE_CONVERSATION: "💬",
    REVIEW: "🔄",
    PLACEMENT: "🎯",
  };

  const sessionTypeLabels: Record<string, string> = {
    LESSON: "Structured Lesson",
    FREE_CONVERSATION: "Free Conversation",
    REVIEW: "Review Session",
    PLACEMENT: "Placement Assessment",
  };

  return (
    <Layout>
      <SEO title="Session History" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Session History
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-8">
          Review your past conversations with Amélie
        </p>

        {sessions.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-8">
              <p className="text-5xl mb-4">💬</p>
              <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No sessions yet
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Start your first conversation with Amélie to see it here.
              </p>
              <button
                onClick={() => router.push("/practice")}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Start practicing →
              </button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <button
                key={s.id}
                onClick={() => router.push(`/history/${s.id}`)}
                className="w-full text-left"
              >
                <Card padding="md" className="hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {sessionTypeIcons[s.sessionType] || "💬"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                          Session #{s.sessionNumber}
                        </h3>
                        {!s.endedAt && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {sessionTypeLabels[s.sessionType] || s.sessionType} ·{" "}
                        {s.messageCount} messages
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(s.startedAt).toLocaleDateString()}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">
                        {new Date(s.startedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
