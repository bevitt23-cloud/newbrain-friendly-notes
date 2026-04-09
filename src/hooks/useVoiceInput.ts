import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Hook for Web Speech Recognition (voice-to-text).
 * Returns a toggle function, listening state, and transcript.
 * Appends recognized speech to the provided setter.
 *
 * Reads the user's preferred TTS voice from localStorage ("bfn:tts-voice")
 * and derives the speech recognition language from it so that STT and TTS
 * stay in sync.
 */

// Check browser support
const SpeechRecognition =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

/** Derive BCP-47 lang from the user's selected TTS voice URI stored in localStorage. */
function getRecognitionLang(): string {
  try {
    const storedUri = localStorage.getItem("bfn:tts-voice");
    if (storedUri && typeof speechSynthesis !== "undefined") {
      const voices = speechSynthesis.getVoices();
      const match = voices.find((v) => v.voiceURI === storedUri);
      if (match?.lang) return match.lang;
    }
  } catch {}
  return "en-US";
}

export function useVoiceInput(onTranscript: (text: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = !!SpeechRecognition;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
    };
  }, []);

  const toggle = useCallback(() => {
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = getRecognitionLang();

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          transcript += event.results[i][0].transcript;
        }
      }
      if (transcript.trim()) {
        onTranscript(transcript.trim());
      }
    };

    recognition.onerror = (event: any) => {
      console.warn("[VoiceInput] Error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, onTranscript]);

  return { isListening, toggle, supported };
}
