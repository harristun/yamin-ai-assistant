import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

const BURMESE = /[\u1000-\u109F]/;

export const isBurmese = (text: string) => BURMESE.test(text);

/** Silence (in ms) after the last recognised word before her turn starts. */
const PAUSE_MS = 900;

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  level: number;
  error: string | null;
};

export function useSpeech(options: {
  muted: boolean;
  onFinalTranscript: (text: string) => void;
}) {
  const { muted, onFinalTranscript } = options;
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  // Conversation loop state kept in refs so callbacks stay stable.
  const activeRef = useRef(false);
  const speakingRef = useRef(false);
  const bufferRef = useRef("");
  const pauseTimer = useRef<number | null>(null);
  const langRef = useRef("my-MM");

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const finalRef = useRef(onFinalTranscript);
  finalRef.current = onFinalTranscript;

  const flush = useCallback(() => {
    const text = bufferRef.current.trim();
    bufferRef.current = "";
    setTranscript("");
    if (text) finalRef.current(text);
  }, []);

  useEffect(() => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    if (!Ctor) return;

    const rec: RecognitionLike = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = langRef.current;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        const text = String(res[0]?.transcript ?? "");
        if (res.isFinal) bufferRef.current = `${bufferRef.current} ${text}`.trim();
        else interim += text;
      }
      setTranscript(`${bufferRef.current} ${interim}`.trim());

      // Live-chat behaviour: she answers once the user pauses.
      if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
      pauseTimer.current = window.setTimeout(() => {
        if (bufferRef.current.trim()) flush();
      }, PAUSE_MS);
    };

    rec.onerror = (event: any) => {
      const kind = String(event?.error ?? "speech-error");
      // Burmese recognition is unavailable in some browsers — fall back to English.
      if (kind === "language-not-supported" && langRef.current !== "en-US") {
        langRef.current = "en-US";
        rec.lang = "en-US";
        return;
      }
      if (kind === "no-speech" || kind === "aborted") return;
      setError(kind);
      if (kind === "not-allowed" || kind === "service-not-allowed") {
        activeRef.current = false;
        setListening(false);
      }
    };

    rec.onend = () => {
      // Chrome ends the session periodically; restart to keep the mic open.
      if (activeRef.current && !speakingRef.current) {
        try {
          rec.lang = langRef.current;
          rec.start();
          return;
        } catch {
          /* start races are safe to ignore */
        }
      }
      if (!activeRef.current) setListening(false);
    };

    recognitionRef.current = rec;
    return () => {
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
      try {
        rec.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [flush]);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setLevel(0);
  }, []);

  const startMeter = useCallback(async () => {
    if (streamRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const v = ((data[i] ?? 128) - 128) / 128;
          sum += v * v;
        }
        setLevel(Math.min(1, Math.sqrt(sum / data.length) * 3.2));
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("microphone-denied");
    }
  }, []);

  const startListening = useCallback(() => {
    setError(null);
    const rec = recognitionRef.current;
    if (!rec) {
      setError("unsupported");
      return;
    }
    activeRef.current = true;
    setListening(true);
    void startMeter();
    try {
      rec.lang = langRef.current;
      rec.start();
    } catch {
      /* already running */
    }
  }, [startMeter]);

  const stopListening = useCallback(() => {
    activeRef.current = false;
    if (pauseTimer.current) window.clearTimeout(pauseTimer.current);
    bufferRef.current = "";
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setTranscript("");
    stopMeter();
  }, [stopMeter]);

  /** Cute, bright voice; Burmese text picks a Burmese/Asian voice when present. */
  const pickVoice = useCallback((text: string) => {
    const voices = window.speechSynthesis.getVoices();
    if (!voices.length) return null;
    const burmese = isBurmese(text);
    const match = (re: RegExp) =>
      voices.find((v) => re.test(v.lang) || re.test(v.name)) ?? null;
    if (burmese) {
      return (
        match(/my[-_]?MM|Burmese|Myanmar/i) ??
        match(/th[-_]?TH|zh[-_]?CN|hi[-_]?IN/i) ??
        match(/en[-_]/i)
      );
    }
    return (
      match(/Google US English|Samantha|Zira|Ava|Jenny|Female/i) ?? match(/en[-_]/i)
    );
  }, []);

  const speak = useCallback(
    (text: string) => {
      if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();

      const utter = new SpeechSynthesisUtterance(text);
      const voice = pickVoice(text);
      if (voice) utter.voice = voice;
      utter.lang = voice?.lang ?? (isBurmese(text) ? "my-MM" : "en-US");
      utter.rate = isBurmese(text) ? 0.95 : 1.02;
      utter.pitch = 1.45; // cute, bright timbre
      utter.volume = 1;

      utter.onstart = () => {
        speakingRef.current = true;
        setSpeaking(true);
        // Mute the mic while she talks so she never hears herself.
        try {
          recognitionRef.current?.stop();
        } catch {
          /* noop */
        }
      };
      const done = () => {
        speakingRef.current = false;
        setSpeaking(false);
        if (activeRef.current) {
          try {
            recognitionRef.current!.lang = langRef.current;
            recognitionRef.current?.start();
          } catch {
            /* noop */
          }
        }
      };
      utter.onend = done;
      utter.onerror = done;
      window.speechSynthesis.speak(utter);
    },
    [muted, pickVoice],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    setSpeaking(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    // Voice list loads asynchronously in Chrome.
    const warm = () => window.speechSynthesis.getVoices();
    warm();
    window.speechSynthesis.onvoiceschanged = warm;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  useEffect(() => () => stopMeter(), [stopMeter]);
  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted, stopSpeaking]);

  const state: SpeechState = { supported, listening, speaking, transcript, level, error };
  return { ...state, startListening, stopListening, speak, stopSpeaking };
}
