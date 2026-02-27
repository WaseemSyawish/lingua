import React, { useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChatMessage } from "@/types";

interface ChatInterfaceProps {
  sessionId: string;
  initialMessages?: ChatMessage[];
  onSessionEnd?: () => void;
}

export default function ChatInterface({
  sessionId,
  initialMessages = [],
  onSessionEnd,
}: ChatInterfaceProps) {
  const { messages, isStreaming, error, sendMessage, clearError, setMessages } =
    useChat({
      sessionId,
      onError: (err) => console.error("Chat error:", err),
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load initial messages
  useEffect(() => {
    if (initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages, setMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEndSession = async () => {
    try {
      await fetch(`/api/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end" }),
      });
      onSessionEnd?.();
    } catch (err) {
      console.error("Failed to end session:", err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <span className="text-lg font-semibold text-indigo-600 dark:text-indigo-400">
              A
            </span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Amélie
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isStreaming ? "Typing..." : "French Tutor"}
            </p>
          </div>
        </div>
        <button
          onClick={handleEndSession}
          className="text-xs text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          End Session
        </button>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-1"
      >
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mb-4">
              <span className="text-2xl">🇫🇷</span>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Start chatting with Amélie
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
              Say hello to begin your French lesson! Amélie will adapt to your
              level and help you practice.
            </p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as "user" | "assistant" | "system"}
            content={msg.content}
            isStreaming={
              isStreaming &&
              idx === messages.length - 1 &&
              msg.role === "assistant"
            }
          />
        ))}

        {/* Error display */}
        {error && (
          <div className="flex justify-center my-2">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm px-4 py-2 rounded-lg flex items-center gap-2">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput
        onSend={sendMessage}
        disabled={isStreaming}
        placeholder={
          isStreaming ? "Amélie is typing..." : "Type your message in French or English..."
        }
      />
    </div>
  );
}
