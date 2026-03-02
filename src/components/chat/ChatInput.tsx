import React, { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Send, Mic, MicOff } from "lucide-react";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isListening?: boolean;
  transcript?: string;
  onStartListening?: () => void;
  onStopListening?: () => void;
}

export default function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  isListening = false,
  transcript = "",
  onStartListening,
  onStopListening,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When transcript updates from STT, append to input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || disabled) return;
    // Stop listening if active
    if (isListening) onStopListening?.();
    onSend(input.trim());
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleMicToggle = () => {
    if (isListening) {
      onStopListening?.();
    } else {
      onStartListening?.();
    }
  };

  return (
    <div className="border-t bg-background px-4 py-3">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        {/* Mic button */}
        {onStartListening && (
          <Button
            size="icon"
            variant={isListening ? "destructive" : "outline"}
            onClick={handleMicToggle}
            disabled={disabled}
            className="flex-shrink-0 rounded-xl"
            aria-label={isListening ? "Stop recording" : "Start recording"}
            title={isListening ? "Stop recording" : "Speak in French"}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </Button>
        )}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? "Listening... speak in French" : placeholder}
            disabled={disabled}
            rows={1}
            className={`w-full resize-none rounded-xl border bg-muted/50 px-4 py-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed ${isListening ? "ring-2 ring-destructive/50 border-destructive/30" : ""}`}
          />
          {isListening && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className="size-2 bg-destructive rounded-full animate-pulse" />
            </span>
          )}
        </div>
        <Button
          size="icon"
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="flex-shrink-0 rounded-xl"
          aria-label="Send message"
        >
          <Send className="size-4" />
        </Button>
      </div>
      <p className="text-center text-[10px] text-muted-foreground mt-2">
        {isListening ? "Listening... click mic to stop, then send" : "Enter to send · Shift+Enter for new line"}
      </p>
    </div>
  );
}
