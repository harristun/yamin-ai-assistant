import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkle } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { ChatMessage } from "./types";

const QUICK_PROMPTS = ["မင်္ဂလာပါ", "Translate to English", "Teach me something", "နေကောင်းလား"];

export function ChatPanel({
  messages,
  thinking,
  onSend,
}: {
  messages: ChatMessage[];
  thinking: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  const submit = (text: string) => {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div
        ref={feedRef}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl glass-panel p-3 sm:p-4"
      >
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-[85%] min-w-0">
                {m.role === "assistant" ? (
                  <div className="mb-1 flex items-center gap-1.5">
                    <span className="rounded-full bg-silk px-2 py-0.5 font-burmese text-[10px] text-gold-foreground">
                      ယမင်း AI
                    </span>
                  </div>
                ) : null}
                <div
                  className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-md bg-primary text-primary-foreground"
                      : "rounded-bl-md border border-glass-border bg-background/70 text-foreground"
                  }`}
                >
                  <p className="font-burmese break-words whitespace-pre-wrap">{m.text}</p>
                </div>
                <p
                  suppressHydrationWarning
                  className={`mt-1 text-[10px] text-muted-foreground ${
                    m.role === "user" ? "text-right" : ""
                  }`}
                >
                  {m.time}
                </p>

              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkle className="h-3.5 w-3.5 text-gold" />
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-gold"
                  animate={{ opacity: [0.2, 1, 0.2] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.16 }}
                />
              ))}
            </span>
          </div>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => submit(p)}
            className="shrink-0 rounded-full glass-panel px-3 py-1.5 font-burmese text-xs text-foreground/75 transition hover:text-foreground active:scale-95"
          >
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(draft);
        }}
        className="flex items-center gap-2 rounded-2xl glass-panel p-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message… / စာရေးပါ"
          className="min-w-0 flex-1 bg-transparent px-2 py-2 font-burmese text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Send message"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-silk text-gold-foreground shadow-glow-gold transition active:scale-95"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
