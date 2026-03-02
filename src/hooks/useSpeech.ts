import { useCallback, useRef, useState } from "react";

interface SpeechState {
  isSpeaking: boolean;
  isLoading: boolean;
  error: string | null;
}

interface ListenState {
  isListening: boolean;
  transcript: string;
  listenError: string | null;
}

/**
 * Azure Cognitive Services TTS + STT hook.
 * Supports multiple languages via voiceName and sttLocale parameters.
 */

const VOICE_MAP: Record<string, string> = {
  fr: "fr-FR-DeniseNeural",
  es: "es-ES-ElviraNeural",
  de: "de-DE-ConradNeural",
};

const STT_LOCALE_MAP: Record<string, string> = {
  fr: "fr-FR",
  es: "es-ES",
  de: "de-DE",
};

export function useSpeech(targetLanguage: string = "fr") {
  const [ttsState, setTtsState] = useState<SpeechState>({
    isSpeaking: false,
    isLoading: false,
    error: null,
  });
  const [sttState, setSttState] = useState<ListenState>({
    isListening: false,
    transcript: "",
    listenError: null,
  });

  const synthRef = useRef<any>(null);
  const recognizerRef = useRef<any>(null);
  const speakLockRef = useRef(false);
  const cancelledRef = useRef(false);
  // Web Audio API handles — the only way to truly stop mid-playback
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const tokenCacheRef = useRef<{ token: string; region: string; expiresAt: number } | null>(null);
  // Callback fired when TTS finishes speaking (used by voice-mode loop)
  const onSpeechEndRef = useRef<(() => void) | null>(null);

  const getToken = useCallback(async (): Promise<{ token: string; region: string }> => {
    const now = Date.now();
    if (tokenCacheRef.current && tokenCacheRef.current.expiresAt > now) {
      return tokenCacheRef.current;
    }
    const res = await fetch("/api/speech/token");
    if (!res.ok) throw new Error("Speech service unavailable");
    const data = await res.json();
    tokenCacheRef.current = {
      token: data.token,
      region: data.region,
      expiresAt: now + 9 * 60 * 1000,
    };
    return tokenCacheRef.current;
  }, []);

  // ── TTS ──────────────────────────────────────────────────────
  const speak = useCallback(
    async (text: string) => {
      if (speakLockRef.current) return;
      speakLockRef.current = true;
      cancelledRef.current = false;

      // Tear down any previous synthesis
      if (synthRef.current) {
        try { synthRef.current.close(); } catch {}
        synthRef.current = null;
      }

      setTtsState({ isSpeaking: false, isLoading: true, error: null });

      try {
        const { token, region } = await getToken();
        if (cancelledRef.current) return;

        const sdk = await import("microsoft-cognitiveservices-speech-sdk");
        if (cancelledRef.current) return;

        const authConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
        authConfig.speechSynthesisVoiceName = VOICE_MAP[targetLanguage] || VOICE_MAP.fr;
        // Raw PCM gives us bytes we can feed to Web Audio API
        authConfig.speechSynthesisOutputFormat =
          sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

        // Pass null so the SDK does NOT auto-play — we get audioData in the result
        const synthesizer = new sdk.SpeechSynthesizer(authConfig, null as any);
        synthRef.current = synthesizer;

        // Phase 1: fetch audio bytes
        const audioData = await new Promise<ArrayBuffer>((resolve, reject) => {
          synthesizer.speakTextAsync(
            text,
            (result: any) => {
              synthesizer.close();
              synthRef.current = null;
              if (cancelledRef.current) { resolve(new ArrayBuffer(0)); return; }
              if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
                resolve(result.audioData as ArrayBuffer);
              } else {
                reject(new Error(`TTS synthesis failed: ${result.errorDetails}`));
              }
            },
            (err: any) => {
              synthesizer.close();
              synthRef.current = null;
              if (cancelledRef.current) { resolve(new ArrayBuffer(0)); } else { reject(err); }
            }
          );
        });

        if (cancelledRef.current || audioData.byteLength === 0) {
          setTtsState({ isSpeaking: false, isLoading: false, error: null });
          return;
        }

        // Phase 2: decode + play via Web Audio API (gives us a real .stop() handle)
        const audioCtx = new AudioContext();
        audioContextRef.current = audioCtx;
        const buffer = await audioCtx.decodeAudioData(audioData.slice(0));

        if (cancelledRef.current) {
          try { audioCtx.close(); } catch {}
          audioContextRef.current = null;
          setTtsState({ isSpeaking: false, isLoading: false, error: null });
          return;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        audioSourceRef.current = source;

        setTtsState({ isSpeaking: true, isLoading: false, error: null });

        await new Promise<void>((resolve) => {
          source.onended = () => resolve();
          source.start(0);
        });

        if (!cancelledRef.current) {
          setTtsState({ isSpeaking: false, isLoading: false, error: null });
          // Fire onSpeechEnd callback (voice-mode loop uses this)
          onSpeechEndRef.current?.();
        }
      } catch (err: any) {
        if (!cancelledRef.current) {
          console.error("Speech synthesis error:", err);
          setTtsState({ isSpeaking: false, isLoading: false, error: "Speech unavailable" });
        }
      } finally {
        speakLockRef.current = false;
        audioSourceRef.current = null;
        if (audioContextRef.current) {
          try { audioContextRef.current.close(); } catch {}
          audioContextRef.current = null;
        }
      }
    },
    [getToken, targetLanguage]
  );

  const stop = useCallback(() => {
    cancelledRef.current = true;
    // Stop Web Audio playback immediately
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch {}
      audioSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    // Cancel any in-progress synthesis
    if (synthRef.current) {
      try { synthRef.current.close(); } catch {}
      synthRef.current = null;
    }
    speakLockRef.current = false;
    setTtsState({ isSpeaking: false, isLoading: false, error: null });
  }, []);

  // ── STT ──────────────────────────────────────────────────────
  const startListening = useCallback(
    async (onTranscript?: (text: string) => void) => {
      // Stop TTS if speaking
      stop();

      if (recognizerRef.current) {
        try { recognizerRef.current.stopContinuousRecognitionAsync(); } catch {}
        recognizerRef.current = null;
      }

      setSttState({ isListening: false, transcript: "", listenError: null });

      try {
        const { token, region } = await getToken();
        const sdk = await import("microsoft-cognitiveservices-speech-sdk");

        const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(token, region);
        speechConfig.speechRecognitionLanguage = STT_LOCALE_MAP[targetLanguage] || STT_LOCALE_MAP.fr;

        const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
        recognizerRef.current = recognizer;

        let fullTranscript = "";

        recognizer.recognizing = (_: any, e: any) => {
          // Interim results — show partial text
          setSttState((s) => ({
            ...s,
            transcript: fullTranscript + (fullTranscript ? " " : "") + e.result.text,
          }));
        };

        recognizer.recognized = (_: any, e: any) => {
          if (e.result.reason === sdk.ResultReason.RecognizedSpeech && e.result.text) {
            fullTranscript += (fullTranscript ? " " : "") + e.result.text;
            setSttState((s) => ({ ...s, transcript: fullTranscript }));
            onTranscript?.(fullTranscript);
          }
        };

        recognizer.canceled = (_: any, e: any) => {
          if (e.reason === sdk.CancellationReason.Error) {
            setSttState((s) => ({
              ...s,
              isListening: false,
              listenError: "Microphone access denied or unavailable",
            }));
          }
          recognizer.stopContinuousRecognitionAsync();
          recognizerRef.current = null;
        };

        recognizer.sessionStopped = () => {
          setSttState((s) => ({ ...s, isListening: false }));
          recognizerRef.current = null;
        };

        recognizer.startContinuousRecognitionAsync(
          () => setSttState((s) => ({ ...s, isListening: true })),
          (err: any) => {
            console.error("STT start error:", err);
            setSttState({
              isListening: false,
              transcript: "",
              listenError: "Could not start microphone",
            });
          }
        );
      } catch (err: any) {
        console.error("STT error:", err);
        setSttState({
          isListening: false,
          transcript: "",
          listenError: "Speech recognition unavailable",
        });
      }
    },
    [getToken, stop]
  );

  const stopListening = useCallback(() => {
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync(
        () => {
          recognizerRef.current = null;
          setSttState((s) => ({ ...s, isListening: false }));
        },
        () => {
          recognizerRef.current = null;
          setSttState((s) => ({ ...s, isListening: false }));
        }
      );
    } else {
      setSttState((s) => ({ ...s, isListening: false }));
    }
  }, []);

  return {
    // TTS
    isSpeaking: ttsState.isSpeaking,
    isLoading: ttsState.isLoading,
    error: ttsState.error,
    speak,
    stop,
    onSpeechEndRef,
    // STT
    isListening: sttState.isListening,
    transcript: sttState.transcript,
    listenError: sttState.listenError,
    startListening,
    stopListening,
  };
}
