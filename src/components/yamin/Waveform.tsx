import { motion } from "framer-motion";

const BARS = 22;

export function Waveform({
  active,
  level,
  tone = "jade",
}: {
  active: boolean;
  level: number;
  tone?: "jade" | "gold";
}) {
  const amp = active ? Math.max(0.22, level) : 0.06;

  return (
    <div className="flex h-12 items-center justify-center gap-[3px] rounded-full glass-panel px-4 py-2">
      {Array.from({ length: BARS }).map((_, i) => {
        const center = 1 - Math.abs(i - (BARS - 1) / 2) / ((BARS - 1) / 2);
        const target = 6 + amp * 30 * (0.35 + center);
        return (
          <motion.span
            key={i}
            className={
              tone === "gold"
                ? "w-[3px] rounded-full bg-gold"
                : "w-[3px] rounded-full bg-jade"
            }
            animate={{ height: active ? [6, target, 8] : 5, opacity: active ? 1 : 0.45 }}
            transition={{
              duration: 0.55 + (i % 5) * 0.07,
              repeat: active ? Infinity : 0,
              repeatType: "mirror",
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}
