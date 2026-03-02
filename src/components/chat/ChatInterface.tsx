import React, { useRef, useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useChat } from "@/hooks/useChat";
import { useSpeech } from "@/hooks/useSpeech";
import { getTutorConfig } from "@/curriculum/prompts/base-persona";
import ReactCountryFlag from "react-country-flag";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { ChatMessage } from "@/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  LogOut,
  Volume2,
  VolumeX,
  Phone,
  PhoneOff,
} from "lucide-react";

interface ChatInterfaceProps {
  sessionId?: string;
  pendingSessionType?: string;
  onSessionCreated?: (sessionId: string) => void;
  initialMessages?: ChatMessage[];
  onSessionEnd?: () => void;
  isPlacement?: boolean;
  onPlacementComplete?: () => void;
  onSessionComplete?: (sessionId: string) => void;
  targetLanguage?: string;
  conversationTopic?: string;
}

export default function ChatInterface({
  sessionId: initialSessionId,
  pendingSessionType,
  onSessionCreated,
  initialMessages = [],
  onSessionEnd,
  isPlacement = false,
  onPlacementComplete,
  onSessionComplete,
  targetLanguage = "fr",
  conversationTopic,
}: ChatInterfaceProps) {
  const { data: authSession } = useSession();
  const tutor = getTutorConfig(targetLanguage);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  // Keep sessionId in sync if parent provides a new one
  useEffect(() => {
    if (initialSessionId) setSessionId(initialSessionId);
  }, [initialSessionId]);

  const { messages, isStreaming, error, sendMessage: chatSendMessage, clearError, setMessages } =
    useChat({
      sessionId: sessionId || "",
      onError: (err) => console.error("Chat error:", err),
      onPlacementComplete,
      onSessionComplete,
    });

  const { speak, stop, isSpeaking, isLoading: isSpeechLoading, startListening, stopListening, isListening, transcript, onSpeechEndRef } = useSpeech(targetLanguage);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [autoTTS, setAutoTTS] = useState(true);
  const lastAutoPlayedRef = useRef<string | null>(null);

  // ── Voice Mode (back-and-forth conversation) ──
  const [voiceMode, setVoiceMode] = useState(false);
  const voiceModeRef = useRef(false);
  const voiceSilenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceTranscriptRef = useRef("");
  const voiceWaitingForResponse = useRef(false);

  // Keep ref in sync
  useEffect(() => {
    voiceModeRef.current = voiceMode;
  }, [voiceMode]);

  // Clear speakingMsgId reactively when the TTS hook finishes (avoids .finally() race)
  useEffect(() => {
    if (!isSpeaking && !isSpeechLoading && speakingMsgId) {
      setSpeakingMsgId(null);
    }
  }, [isSpeaking, isSpeechLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-TTS: automatically speak new assistant messages when streaming completes
  useEffect(() => {
    if (!autoTTS || isStreaming || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg &&
      lastMsg.role === "assistant" &&
      lastMsg.content &&
      lastMsg.id !== lastAutoPlayedRef.current &&
      !speakingMsgId // don't interrupt ongoing speech
    ) {
      lastAutoPlayedRef.current = lastMsg.id;
      setSpeakingMsgId(lastMsg.id);
      speak(lastMsg.content);
    }
  }, [messages, isStreaming, autoTTS]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice-mode: when AI finishes speaking, auto-restart listening
  useEffect(() => {
    onSpeechEndRef.current = () => {
      if (voiceModeRef.current) {
        voiceWaitingForResponse.current = false;
        setTimeout(() => {
          if (voiceModeRef.current) {
            voiceTranscriptRef.current = "";
            startListening((text: string) => {
              voiceTranscriptRef.current = text;
              if (voiceSilenceTimer.current) clearTimeout(voiceSilenceTimer.current);
              voiceSilenceTimer.current = setTimeout(() => {
                if (voiceModeRef.current && voiceTranscriptRef.current.trim()) {
                  const msg = voiceTranscriptRef.current.trim();
                  voiceTranscriptRef.current = "";
                  stopListening();
                  voiceWaitingForResponse.current = true;
                  sendMessage(msg);
                }
              }, 1800);
            });
          }
        }, 400);
      }
    };
    return () => { onSpeechEndRef.current = null; };
  }, [startListening, stopListening]); // eslint-disable-line react-hooks/exhaustive-deps

  // Voice-mode: ensure AI responses are always spoken in voice mode
  useEffect(() => {
    if (!voiceModeRef.current || isStreaming || messages.length === 0) return;
    if (!voiceWaitingForResponse.current) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "assistant" && lastMsg.content && lastMsg.id !== lastAutoPlayedRef.current) {
      lastAutoPlayedRef.current = lastMsg.id;
      setSpeakingMsgId(lastMsg.id);
      speak(lastMsg.content);
    }
  }, [messages, isStreaming]); // eslint-disable-line react-hooks/exhaustive-deps

  const startVoiceMode = useCallback(() => {
    setVoiceMode(true);
    setAutoTTS(true);
    voiceWaitingForResponse.current = false;
    voiceTranscriptRef.current = "";
    startListening((text: string) => {
      voiceTranscriptRef.current = text;
      if (voiceSilenceTimer.current) clearTimeout(voiceSilenceTimer.current);
      voiceSilenceTimer.current = setTimeout(() => {
        if (voiceModeRef.current && voiceTranscriptRef.current.trim()) {
          const msg = voiceTranscriptRef.current.trim();
          voiceTranscriptRef.current = "";
          stopListening();
          voiceWaitingForResponse.current = true;
          sendMessage(msg);
        }
      }, 1800);
    });
  }, [startListening, stopListening]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopVoiceMode = useCallback(() => {
    setVoiceMode(false);
    voiceWaitingForResponse.current = false;
    voiceTranscriptRef.current = "";
    if (voiceSilenceTimer.current) { clearTimeout(voiceSilenceTimer.current); voiceSilenceTimer.current = null; }
    stopListening();
    stop();
  }, [stopListening, stop]);

  const handleSpeak = useCallback(
    (msgId: string, text: string) => {
      if (speakingMsgId) {
        // Something is already active (loading or speaking) — stop it
        stop();
        setSpeakingMsgId(null);
      } else {
        setSpeakingMsgId(msgId);
        speak(text); // speakLockRef inside useSpeech prevents overlapping calls
      }
    },
    [speak, stop, speakingMsgId]
  );

  const handleStartListening = useCallback(() => {
    startListening();
  }, [startListening]);

  const handleStopListening = useCallback(() => {
    stopListening();
  }, [stopListening]);

  // Lazy session creation: create session on first message if pendingSessionType is set
  // Also used for warm intro: auto-creates session and requests tutor greeting
  const pendingMessageRef = useRef<string | null>(null);
  const warmIntroSent = useRef(false);
  const sessionCreating = useRef(false);

  // Auto-create session on mount for warm intro (tutor greets first)
  useEffect(() => {
    if (!sessionId && pendingSessionType && !isPlacement && !sessionCreating.current) {
      sessionCreating.current = true;
      setIsCreatingSession(true);
      fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionType: pendingSessionType }),
      })
        .then((res) => res.ok ? res.json() : Promise.reject("Failed"))
        .then((data) => {
          const newId = data.session?.id || data.id;
          setSessionId(newId);
          onSessionCreated?.(newId);
        })
        .catch((err) => console.error("Failed to auto-create session:", err))
        .finally(() => setIsCreatingSession(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId && pendingSessionType) {
        // If auto-create is already in-flight, just queue the message
        if (sessionCreating.current) {
          pendingMessageRef.current = content;
          return;
        }
        sessionCreating.current = true;
        setIsCreatingSession(true);
        try {
          const res = await fetch("/api/sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionType: pendingSessionType }),
          });
          if (!res.ok) throw new Error("Failed to create session");
          const data = await res.json();
          const newId = data.session?.id || data.id;
          setSessionId(newId);
          onSessionCreated?.(newId);
          // Small delay to let useChat pick up the new sessionId
          await new Promise((r) => setTimeout(r, 50));
          setIsCreatingSession(false);
          // Send the message with the newly created session
          pendingMessageRef.current = content;
        } catch (err) {
          console.error("Failed to create session:", err);
          setIsCreatingSession(false);
          sessionCreating.current = false;
        }
      } else {
        chatSendMessage(content);
      }
    },
    [sessionId, pendingSessionType, chatSendMessage, onSessionCreated]
  );

  // Warm intro: when sessionId becomes available with pending type, auto-request a tutor greeting
  useEffect(() => {
    if (sessionId && pendingSessionType && !isPlacement && !warmIntroSent.current && messages.length === 0 && !pendingMessageRef.current) {
      warmIntroSent.current = true;
      const warmMsg = conversationTopic
        ? `[START_SESSION] ${conversationTopic}`
        : "[START_SESSION]";
      chatSendMessage(warmMsg);
    }
  }, [sessionId, pendingSessionType]); // eslint-disable-line react-hooks/exhaustive-deps

  // Send pending message once sessionId is available
  useEffect(() => {
    if (sessionId && pendingMessageRef.current) {
      const msg = pendingMessageRef.current;
      pendingMessageRef.current = null;
      chatSendMessage(msg);
    }
  }, [sessionId, chatSendMessage]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialMessages.length > 0) setMessages(initialMessages);
  }, [initialMessages, setMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleEndSession = async () => {
    if (voiceMode) stopVoiceMode();
    if (!sessionId) {
      onSessionEnd?.();
      return;
    }
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

  const MAX_PLACEMENT_EXCHANGES = 12;
  const placementExchanges = isPlacement
    ? messages.filter((m) => m.role === "assistant").length
    : 0;
  const placementPct = Math.min((placementExchanges / MAX_PLACEMENT_EXCHANGES) * 100, 100);

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {tutor.name[0]}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-sm font-semibold">{tutor.name}</h2>
            <p className="text-xs text-muted-foreground">
              {isStreaming ? "Typing..." : voiceMode ? "Voice conversation" : `${tutor.language} Tutor`}
            </p>
          </div>
        </div>
        {isPlacement ? (
          <div className="flex flex-col items-end gap-1 min-w-[120px]">
            <span className="text-[11px] text-muted-foreground">
              Placement · {placementExchanges}/{MAX_PLACEMENT_EXCHANGES}
            </span>
            <Progress value={placementPct} className="h-1.5 w-28" />
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              variant={voiceMode ? "default" : "outline"}
              size="sm"
              onClick={voiceMode ? stopVoiceMode : startVoiceMode}
              className={`h-8 px-2.5 gap-1.5 text-xs ${voiceMode ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
              title={voiceMode ? "End voice conversation" : "Start voice conversation"}
            >
              {voiceMode ? <PhoneOff className="size-3.5" /> : <Phone className="size-3.5" />}
              {voiceMode ? "End Call" : "Voice"}
            </Button>
            {!voiceMode && (
              <Button
                variant={autoTTS ? "secondary" : "ghost"}
                size="sm"
                onClick={() => { if (autoTTS) stop(); setAutoTTS(!autoTTS); }}
                className="h-8 px-2.5 gap-1.5 text-xs"
                title={autoTTS ? "Auto-voice on \u2014 click to mute" : "Auto-voice off \u2014 click to enable"}
              >
                {autoTTS ? <Volume2 className="size-3.5 text-primary" /> : <VolumeX className="size-3.5 text-muted-foreground" />}
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndSession}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="size-4 mr-1" />
              End
            </Button>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
        {messages.length === 0 && !isStreaming && !isCreatingSession && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "2rem", height: "2rem" }} className="rounded" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              Start chatting with {tutor.name}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Say hello to begin your {tutor.language} lesson! {tutor.name} will adapt to your
              level and help you practice.
            </p>
          </div>
        )}

        {messages.length === 0 && (isStreaming || isCreatingSession) && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-pulse">
              <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "2rem", height: "2rem" }} className="rounded" />
            </div>
            <h3 className="text-lg font-semibold mb-2">
              {tutor.name} is preparing your session...
            </h3>
          </div>
        )}

        {messages.map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            role={msg.role as "user" | "assistant" | "system"}
            content={msg.content}
            userName={authSession?.user?.name || undefined}
            tutorInitial={tutor.name[0]}
            tutorName={tutor.name}
            onSpeak={msg.role === "assistant" ? (text) => handleSpeak(msg.id, text) : undefined}
            isSpeaking={speakingMsgId === msg.id}
            isSpeechLoading={speakingMsgId === msg.id && isSpeechLoading && !isSpeaking}
            isStreaming={isStreaming && idx === messages.length - 1 && msg.role === "assistant"}
          />
        ))}

        {error && (
          <div className="flex justify-center my-2">
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-2 rounded-lg flex items-center gap-2">
              <span>{error}</span>
              <button onClick={clearError}>
                <X className="size-3" />
              </button>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Voice Mode Overlay */}
      <AnimatePresence>
        {voiceMode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
          >
            {(isSpeaking || isSpeechLoading) ? (
              <>
                <motion.div className="absolute size-48 rounded-full bg-primary/10" animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <motion.div className="absolute size-36 rounded-full bg-primary/15" animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} />
              </>
            ) : isListening ? (
              <>
                <motion.div className="absolute size-48 rounded-full bg-green-500/10" animate={{ scale: [1, 1.4, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
                <motion.div className="absolute size-36 rounded-full bg-green-500/15" animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.3 }} />
              </>
            ) : null}

            <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }} className="mb-6">
              <div className="size-24 rounded-full bg-primary/10 flex items-center justify-center ring-4 ring-primary/20">
                <ReactCountryFlag countryCode={tutor.countryCode} svg style={{ width: "3rem", height: "3rem" }} className="rounded" />
              </div>
            </motion.div>

            <h3 className="text-xl font-bold mb-1">{tutor.name}</h3>
            <p className="text-sm text-muted-foreground mb-8">Voice conversation</p>

            <motion.div key={`${isSpeaking}-${isListening}-${isStreaming}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-8">
              {(isSpeaking || isSpeechLoading) ? (
                <>
                  <Volume2 className="size-4 text-primary animate-pulse" />
                  <span className="text-sm font-medium text-primary">{tutor.name} is speaking...</span>
                </>
              ) : isListening ? (
                <>
                  <span className="size-2.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Listening...</span>
                </>
              ) : isStreaming ? (
                <>
                  <motion.div className="flex gap-1" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.2, repeat: Infinity }}>
                    <span className="size-1.5 bg-muted-foreground rounded-full" />
                    <span className="size-1.5 bg-muted-foreground rounded-full" />
                    <span className="size-1.5 bg-muted-foreground rounded-full" />
                  </motion.div>
                  <span className="text-sm font-medium text-muted-foreground">Thinking...</span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">Starting...</span>
              )}
            </motion.div>

            {isListening && transcript && (
              <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="max-w-md px-4 py-2 mb-6 rounded-xl bg-muted/60 border text-sm text-center">
                {transcript}
              </motion.div>
            )}

            <Button variant="destructive" size="lg" onClick={stopVoiceMode} className="rounded-full size-16 p-0 shadow-lg shadow-destructive/20">
              <PhoneOff className="size-6" />
            </Button>
            <p className="text-[11px] text-muted-foreground mt-3">Tap to end voice conversation</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input (hidden in voice mode) */}
      {!voiceMode && (
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming || isCreatingSession}
          placeholder={
            isCreatingSession
              ? "Starting session..."
              : isStreaming
                ? `${tutor.name} is typing...`
                : `Type your message in ${tutor.language} or English...`
          }
          isListening={isListening}
          transcript={transcript}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
        />
      )}
    </div>
  );
}
