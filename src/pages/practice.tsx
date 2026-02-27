import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Layout from "@/components/layout/Layout";
import SEO from "@/components/SEO";
import ChatInterface from "@/components/chat/ChatInterface";
import Button from "@/components/ui/Button";
import { SessionType } from "@/generated/prisma/enums";
import type { ChatMessage } from "@/types";

type SessionTypeOption = {
  type: SessionType;
  label: string;
  description: string;
  icon: string;
};

const sessionTypes: SessionTypeOption[] = [
  {
    type: SessionType.LESSON,
    label: "Structured Lesson",
    description: "Guided practice with vocabulary and grammar focus",
    icon: "📚",
  },
  {
    type: SessionType.FREE_CONVERSATION,
    label: "Free Conversation",
    description: "Chat freely about any topic in French",
    icon: "💬",
  },
  {
    type: SessionType.REVIEW,
    label: "Review Session",
    description: "Revisit concepts you've been learning",
    icon: "🔄",
  },
];

export default function PracticePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<ChatMessage[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check for existing session ID in query
  useEffect(() => {
    if (router.query.sessionId && typeof router.query.sessionId === "string") {
      loadExistingSession(router.query.sessionId);
    }
  }, [router.query.sessionId]);

  if (status === "loading") {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[80vh]">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!session) {
    router.push("/auth/signin");
    return null;
  }

  async function loadExistingSession(sessionId: string) {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        if (!data.session.endedAt) {
          setActiveSessionId(sessionId);
          setInitialMessages(
            data.session.messages.map((m: any) => ({
              id: m.id,
              role: m.role.toLowerCase(),
              content: m.content,
              createdAt: m.createdAt,
            }))
          );
        }
      }
    } catch {
      // Ignore — will show session picker
    }
  }

  async function createSession(type: SessionType) {
    setIsCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: type }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create session");
      }

      const data = await res.json();
      setActiveSessionId(data.session.id);
      setInitialMessages([]);
      router.replace(`/practice?sessionId=${data.session.id}`, undefined, {
        shallow: true,
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsCreating(false);
    }
  }

  function handleSessionEnd() {
    setActiveSessionId(null);
    setInitialMessages([]);
    router.replace("/practice", undefined, { shallow: true });
  }

  // Active session — show chat
  if (activeSessionId) {
    return (
      <div className="h-screen flex flex-col">
        <ChatInterface
          sessionId={activeSessionId}
          initialMessages={initialMessages}
          onSessionEnd={handleSessionEnd}
        />
      </div>
    );
  }

  // Session picker
  return (
    <Layout>
      <SEO title="Practice" />
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Practice French
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Choose a session type to start practicing with Amélie.
        </p>

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {sessionTypes.map((option) => (
            <button
              key={option.type}
              onClick={() => createSession(option.type)}
              disabled={isCreating}
              className="w-full text-left p-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <div className="flex items-start gap-4">
                <span className="text-3xl">{option.icon}</span>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {option.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {option.description}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Current level:{" "}
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {(session as any)?.user?.cefrLevel || "Not assessed"}
            </span>
          </p>
        </div>
      </div>
    </Layout>
  );
}
