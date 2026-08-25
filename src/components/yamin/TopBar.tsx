import { motion } from "framer-motion";
import { LayoutPanelLeft, RotateCcw, Settings, Volume2, VolumeX } from "lucide-react";

import type { AssistantStatus } from "./types";

const STATUS_LABEL: Record<AssistantStatus, string> = {
  online: "Online",
  listening: "Listening...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

const STATUS_DOT: Record<AssistantStatus, string> = {
  online: "bg-jade",
  listening: "bg-gold",
  thinking: "bg-ruby",
  speaking: "bg-jade",
};

export function TopBar({
  status,
  muted,
  onToggleMute,
  onReset,
  onToggleLayout,
  onOpenSettings,
}: {
  status: AssistantStatus;
  muted: boolean;
  onToggleMute: () => void;
  onReset: () => void;
  onToggleLayout: () => void;
  onOpenSettings: () => void;
}) {
  const iconBtn =
    "grid h-10 w-10 shrink-0 place-items-center rounded-xl glass-panel text-foreground/70 transition-colors hover:text-foreground active:scale-95";

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl glass-panel px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-silk text-sm font-semibold text-gold-foreground shadow-glow-gold">
          <span className="font-burmese">ယ</span>
          <span className="absolute inset-0 rounded-2xl silk-pattern opacity-50" />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">Yamin AI</h1>
            <span className="truncate font-burmese text-sm text-muted-foreground">ယမင်း</span>
          </div>
          <div className="mt-0.5 inline-flex items-center gap-2 rounded-full border border-glass-border bg-background/50 px-2 py-0.5">
            <span className="relative flex h-2 w-2">
              <motion.span
                className={`absolute inset-0 rounded-full ${STATUS_DOT[status]}`}
                animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity }}
              />
              <span className={`relative h-2 w-2 rounded-full ${STATUS_DOT[status]}`} />
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {STATUS_LABEL[status]}
            </span>
          </div>
        </div>
      </div>

      <nav className="flex items-center gap-2">
        <button className={iconBtn} onClick={onToggleMute} aria-label="Toggle sound output">
          {muted ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
        </button>
        <button
          className={`${iconBtn} hidden sm:grid`}
          onClick={onToggleLayout}
          aria-label="Switch layout"
        >
          <LayoutPanelLeft className="h-4.5 w-4.5" />
        </button>
        <button className={iconBtn} onClick={onReset} aria-label="Reset chat">
          <RotateCcw className="h-4.5 w-4.5" />
        </button>
        <button
          className={`${iconBtn} hidden sm:grid`}
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <Settings className="h-4.5 w-4.5" />
        </button>
      </nav>
    </header>
  );
}
