import { useState, useCallback, useRef, useEffect } from "react";
import { ChatMessage } from "@/types";

interface UseChatOptions {
  sessionId: string;
  onError?: (error: string) => void;
  onPlacementComplete?: () => void;
  onSessionComplete?: (sessionId: string) => void;
}

interface UseChatReturn {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearError: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useChat({ sessionId, onError, onPlacementComplete, onSessionComplete }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const clearError = useCallback(() => setError(null), []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isStreaming) return;

      setError(null);

      const isWarmIntro = content.trim() === "[START_SESSION]";

      // Add user message immediately (skip for warm intro — tutor speaks first)
      if (!isWarmIntro) {
        const userMessage: ChatMessage = {
          id: `user-${Date.now()}`,
          role: "user",
          content: content.trim(),
          createdAt: new Date().toISOString(),
        };

        setMessages((prev) => [...prev, userMessage]);
      }

      // Add placeholder for assistant response
      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsStreaming(true);

      // Abort any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: content.trim() }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                if (data.type === "delta") {
                  setMessages((prev) =>
                    prev.map((msg) => {
                      if (msg.id !== assistantId) return msg;
                      // Strip any [SESSION_COMPLETE] or [ASSESSMENT_READY] markers that leaked through streaming
                      const cleaned = (msg.content + data.text)
                        .replace(/\[SESSION_COMPLETE\]/g, "")
                        .replace(/\[ASSESSMENT_READY\]/g, "")
                        .replace(/\n{3,}/g, "\n\n"); // collapse leftover blank lines
                      return { ...msg, content: cleaned };
                    })
                  );
                } else if (data.type === "error") {
                  setError(data.error);
                  onError?.(data.error);
                } else if (data.type === "done") {
                  // Update the assistant message ID and do final content cleanup
                  setMessages((prev) =>
                    prev.map((msg) => {
                      if (msg.id !== assistantId) return msg;
                      // Final belt-and-suspenders cleanup of any leaked markers
                      const finalContent = msg.content
                        .replace(/\[SESSION_COMPLETE\]/gi, "")
                        .replace(/\[ASSESSMENT_READY\]/gi, "")
                        .replace(/\[SESSION_COMPLET[E]?\]/gi, "")
                        .replace(/\[ASSESSMENT_READ[Y]?\]/gi, "")
                        .replace(/\n{3,}/g, "\n\n")
                        .trim();
                      return { ...msg, id: data.messageId || assistantId, content: finalContent };
                    })
                  );
                } else if (data.type === "placement_complete") {
                  // Placement session has reached its final exchange
                  onPlacementComplete?.();
                } else if (data.type === "session_complete") {
                  // Regular session has auto-completed via [SESSION_COMPLETE] marker
                  onSessionComplete?.(data.sessionId || sessionId);
                }
              } catch {
                // Ignore malformed JSON
              }
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;

        const errorMessage =
          err.message || "Failed to send message. Please try again.";
        setError(errorMessage);
        onError?.(errorMessage);

        // Remove the empty assistant message on error
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== assistantId)
        );
      } finally {
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [sessionId, isStreaming, onError, onPlacementComplete, onSessionComplete]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { messages, isStreaming, error, sendMessage, clearError, setMessages };
}
