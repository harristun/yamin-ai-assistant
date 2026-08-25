import { motion } from "framer-motion";
import { Globe, Loader2, Mic, MicOff, Volume2, VolumeX } from "lucide-react";

export function VoiceControls({
  listening,
  speaking,
  muted,
  supported,
  lang,
  onToggleListening,
  onToggleMute,
}: {
  listening: boolean;
  speaking: boolean;
  muted: boolean;
  supported: boolean;
  lang: string;
  onToggleListening: () => void;
  onToggleMute: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-4">
        <button
          onClick={onToggleMute}
          aria-label="Toggle speech output"
          className="grid h-12 w-12 place-items-center rounded-2xl glass-panel text-foreground/70 transition hover:text-foreground active:scale-95"
        >
          {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
        </button>

        <div className="relative">
          {listening ? (
            <>
              <span className="absolute inset-0 rounded-full border-2 border-gold animate-pulse-ring" />
              <span
                className="absolute inset-0 rounded-full border border-ruby/60 animate-pulse-ring"
                style={{ animationDelay: "0.6s" }}
              />
            </>
          ) : null}
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={onToggleListening}
            aria-label={listening ? "Stop listening" : "Tap to speak"}
            className={`relative grid h-20 w-20 place-items-center rounded-full text-gold-foreground shadow-glow-gold transition sm:h-[5.5rem] sm:w-[5.5rem] ${
              listening ? "bg-silk" : "bg-silk/85 hover:bg-silk"
            }`}
          >
            <span className="absolute inset-0 rounded-full silk-pattern opacity-40" />
            {!supported ? (
              <MicOff className="relative h-7 w-7" />
            ) : speaking ? (
              <Loader2 className="relative h-7 w-7 animate-spin" />
            ) : (
              <Mic className="relative h-7 w-7" />
            )}
          </motion.button>
        </div>

        <div className="grid h-12 w-12 place-items-center rounded-2xl glass-panel">
          <Globe className="h-5 w-5 text-jade" />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className="rounded-full border border-glass-border bg-background/60 px-3 py-1 text-[11px] font-medium text-muted-foreground">
          {lang === "my-MM" ? "my-MM (Burmese)" : lang}
        </span>
        <span className="text-[11px] text-muted-foreground">
          {supported
            ? listening
              ? "Listening — tap to stop"
              : "Tap or hold to speak"
            : "Voice input not supported in this browser"}
        </span>
      </div>
    </div>
  );
}
