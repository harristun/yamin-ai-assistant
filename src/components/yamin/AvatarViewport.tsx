import { ClientOnly } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { lazy, Suspense } from "react";

import type { Breakpoint } from "@/hooks/useBreakpoint";
import { Waveform } from "./Waveform";

const AvatarScene = lazy(() => import("./AvatarScene"));

function SceneSkeleton() {
  return (
    <div className="absolute inset-0 grid place-items-center">
      <div className="flex flex-col items-center gap-5">
        <div className="relative h-40 w-40">
          <div className="absolute inset-0 rounded-full skeleton-shimmer" />
          <div className="absolute inset-4 rounded-full bg-background/70" />
          <div className="absolute inset-0 rounded-full border border-gold/40 animate-pulse-ring" />
        </div>
        <div className="space-y-2 text-center">
          <div className="mx-auto h-3 w-40 rounded-full skeleton-shimmer" />
          <div className="mx-auto h-3 w-24 rounded-full skeleton-shimmer" />
          <p className="pt-2 text-xs tracking-[0.28em] text-muted-foreground uppercase">
            Loading avatar
          </p>
        </div>
      </div>
    </div>
  );
}

export function AvatarViewport({
  breakpoint,
  listening,
  speaking,
  level,
  transcript,
}: {
  breakpoint: Breakpoint;
  listening: boolean;
  speaking: boolean;
  level: number;
  transcript: string;
}) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[2rem] glass-panel">
      <div className="pointer-events-none absolute inset-0 bg-aura" />
      <div className="pointer-events-none absolute inset-0 opacity-30 silk-pattern" />

      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 h-52 w-52 rounded-full bg-silk blur-3xl opacity-40 animate-float-slow"
      />

      <div className="absolute inset-0">
        <ClientOnly fallback={<SceneSkeleton />}>
          <Suspense fallback={<SceneSkeleton />}>
            <AvatarScene breakpoint={breakpoint} speaking={speaking} listening={listening} />
          </Suspense>
        </ClientOnly>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 p-4 sm:p-6">
        {transcript ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[92%] rounded-2xl glass-panel px-4 py-2 text-center text-sm text-foreground/80"
          >
            {transcript}
          </motion.p>
        ) : null}
        <Waveform active={listening || speaking} level={level} tone={speaking ? "gold" : "jade"} />
      </div>
    </div>
  );
}
