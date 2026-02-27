import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import Card from "@/components/ui/Card";
import MessageBubble from "@/components/chat/MessageBubble";
import Button from "@/components/ui/Button";

interface SessionDetail {
  id: string;
  sessionNumber: number;
  sessionType: string;
  messageCount: number;
  startedAt: string;
  endedAt: string | null;
  aiModel: string;
  focusConcepts: string[];
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
  summary: {
    topicsCovered: string;
    vocabularyIntroduced: string;
    grammarPracticed: string;
    errorsObserved: string;
    overallNotes: string;
  } | null;
}

export default function SessionDetailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session?.user && id) fetchSession();
  }, [session, id]);

  async function fetchSession() {
    try {
      const res = await fetch(`/api/sessions/${id}`);
      if (res.ok) {
        const json = await res.json();
        setData(json.session);
      } else {
        router.push("/history");
      }
    } finally {
      setLoading(false);
    }
  }

  async function analyzeSession() {
    if (!id) return;
    setAnalyzing(true);
    try {
      const res = await fetch(`/api/sessions/${id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      if (res.ok) {
        // Refresh to show updated summary
        fetchSession();
      }
    } finally {
      setAnalyzing(false);
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

  if (!session || !data) return null;

  const sessionTypeLabels: Record<string, string> = {
    LESSON: "Structured Lesson",
    FREE_CONVERSATION: "Free Conversation",
    REVIEW: "Review Session",
    PLACEMENT: "Placement Assessment",
  };

  return (
    <Layout>
      <SEO title="Session Detail" />
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Back link */}
        <button
          onClick={() => router.push("/history")}
          className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline mb-6 inline-block"
        >
          ← Back to History
        </button>

        {/* Session Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Session #{data.sessionNumber}
          </h1>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
            <span>{sessionTypeLabels[data.sessionType] || data.sessionType}</span>
            <span>·</span>
            <span>{new Date(data.startedAt).toLocaleDateString()}</span>
            <span>·</span>
            <span>{data.messageCount} messages</span>
            {data.endedAt && (
              <>
                <span>·</span>
                <span>
                  {Math.round(
                    (new Date(data.endedAt).getTime() -
                      new Date(data.startedAt).getTime()) /
                      60000
                  )}{" "}
                  min
                </span>
              </>
            )}
          </div>
        </div>

        {/* Session Summary */}
        {data.summary ? (
          <Card padding="lg" className="mb-8">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-3">
              Session Summary
            </h2>
            <div className="space-y-3 text-sm">
              {data.summary.topicsCovered && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Topics:{" "}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {data.summary.topicsCovered}
                  </span>
                </div>
              )}
              {data.summary.vocabularyIntroduced && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Vocabulary:{" "}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {data.summary.vocabularyIntroduced}
                  </span>
                </div>
              )}
              {data.summary.grammarPracticed && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Grammar:{" "}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {data.summary.grammarPracticed}
                  </span>
                </div>
              )}
              {data.summary.errorsObserved && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Errors:{" "}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {data.summary.errorsObserved}
                  </span>
                </div>
              )}
              {data.summary.overallNotes && (
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    Notes:{" "}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    {data.summary.overallNotes}
                  </span>
                </div>
              )}
            </div>
          </Card>
        ) : data.endedAt && data.messages.length >= 4 ? (
          <Card padding="lg" className="mb-8">
            <div className="text-center py-2">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                This session hasn&apos;t been analyzed yet.
              </p>
              <Button
                onClick={analyzeSession}
                loading={analyzing}
                size="sm"
              >
                Analyze Session
              </Button>
            </div>
          </Card>
        ) : null}

        {/* Focus Concepts */}
        {data.focusConcepts.length > 0 && (
          <Card padding="md" className="mb-8">
            <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2">
              Focus Concepts
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.focusConcepts.map((c) => (
                <span
                  key={c}
                  className="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 px-2 py-1 rounded-md"
                >
                  {c.replace(/\./g, " › ")}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Conversation */}
        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Conversation
        </h2>
        <div className="space-y-1 bg-gray-50 dark:bg-gray-900/50 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
          {data.messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              role={msg.role.toLowerCase() as "user" | "assistant"}
              content={msg.content}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}
