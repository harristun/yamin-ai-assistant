import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
};

export type SpeechState = {
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  transcript: string;
  level: number;
  error: string | null;
};

export function useSpeech(options: {
  lang: string;
  muted: boolean;
  onFinalTranscript: (text: string) => void;
}) {
  const { lang, muted, onFinalTranscript } = options;
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const finalRef = useRef(onFinalTranscript);
  finalRef.current = onFinalTranscript;

  useEffect(() => {
    const w = window as any;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(Boolean(Ctor));
    if (!Ctor) return;

    const rec: RecognitionLike = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) {
          const text = String(res[0].transcript).trim();
          setTranscript("");
          if (text) finalRef.current(text);
        } else {
          interim += res[0].transcript;
        }
      }
      if (interim) setTranscript(interim);
    };
    rec.onerror = (event: any) => {
      setError(String(event?.error ?? "speech-error"));
      setListening(false);
    };
    rec.onend = () => setListening(false);

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
  }, [lang]);

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
    try {
      rec.lang = lang;
      rec.start();
      setListening(true);
      void startMeter();
    } catch {
      /* already started */
    }
  }, [lang, startMeter]);

  const stopListening = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
    setTranscript("");
    stopMeter();
  }, [stopMeter]);

  const speak = useCallback(
    (text: string) => {
      if (muted || typeof window === "undefined" || !("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = lang;
      utter.rate = 0.98;
      utter.pitch = 1.08;
      utter.onstart = () => setSpeaking(true);
      utter.onend = () => setSpeaking(false);
      utter.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utter);
    },
    [lang, muted],
  );

  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  useEffect(() => () => stopMeter(), [stopMeter]);
  useEffect(() => {
    if (muted) stopSpeaking();
  }, [muted, stopSpeaking]);

  const state: SpeechState = { supported, listening, speaking, transcript, level, error };
  return { ...state, startListening, stopListening, speak, stopSpeaking };
}
