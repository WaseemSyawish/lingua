import React from "react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

interface MessageBubbleProps {
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming?: boolean;
  userName?: string;
  tutorInitial?: string;
  tutorName?: string;
  onSpeak?: (text: string) => void;
  isSpeaking?: boolean;
  isSpeechLoading?: boolean;
}

function getUserInitials(name?: string): string {
  if (!name || !name.trim()) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0][0].toUpperCase();
}

export default function MessageBubble({
  role,
  content,
  isStreaming,
  userName,
  tutorInitial = "A",
  tutorName = "Amélie",
  onSpeak,
  isSpeaking,
  isSpeechLoading,
}: MessageBubbleProps) {
  if (role === "system") {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-muted text-muted-foreground text-xs px-4 py-2 rounded-full max-w-md text-center">
          {content}
        </div>
      </div>
    );
  }

  const isUser = role === "user";

  return (
    <div
      className={cn("flex w-full mb-4", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex-shrink-0 mr-3 mt-1">
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {tutorInitial}
            </AvatarFallback>
          </Avatar>
        </div>
      )}

      <div
        className={cn(
          "max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-card border rounded-bl-md"
        )}
      >
        <div className="whitespace-pre-wrap break-words">
          {content}
          {isStreaming && !content && (
            <span className="inline-flex gap-1 ml-1">
              <span
                className="size-1.5 bg-muted-foreground rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="size-1.5 bg-muted-foreground rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="size-1.5 bg-muted-foreground rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </span>
          )}
          {isStreaming && content && (
            <span className="inline-block w-0.5 h-4 bg-muted-foreground ml-0.5 animate-pulse" />
          )}
        </div>
        {/* Speak button — only on completed assistant messages */}
        {!isUser && !isStreaming && content && onSpeak && (
          <button
            onClick={() => onSpeak(content)}
            className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
            title={isSpeechLoading ? "Cancel" : isSpeaking ? "Stop speaking" : `Listen to ${tutorName}`}
          >
            {isSpeechLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : isSpeaking ? (
              <VolumeX className="size-3" />
            ) : (
              <Volume2 className="size-3" />
            )}
            <span>{isSpeechLoading ? "Loading…" : isSpeaking ? "Stop" : "Listen"}</span>
          </button>
        )}
      </div>

      {isUser && (
        <div className="flex-shrink-0 ml-3 mt-1">
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-secondary-foreground text-sm font-semibold">
              {getUserInitials(userName)}
            </AvatarFallback>
          </Avatar>
        </div>
      )}
    </div>
  );
}
