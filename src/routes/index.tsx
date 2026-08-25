import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp, MessageCircle, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { AvatarViewport } from "@/components/yamin/AvatarViewport";
import { ChatPanel } from "@/components/yamin/ChatPanel";
import { TopBar } from "@/components/yamin/TopBar";
import { VoiceControls } from "@/components/yamin/VoiceControls";
import type { AssistantStatus, ChatMessage } from "@/components/yamin/types";
import { useBreakpoint } from "@/hooks/useBreakpoint";
import { useSpeech } from "@/hooks/useSpeech";
import { yaminChat } from "@/lib/yamin.functions";
import { useServerFn } from "@tanstack/react-start";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Yamin AI — 3D Burmese Voice Assistant" },
      {
        name: "description",
        content:
          "Talk with Yamin AI (ယမင်း), a 3D Burmese voice assistant with speech recognition, spoken replies and a glassmorphic chat studio.",
      },
      { property: "og:title", content: "Yamin AI — 3D Burmese Voice Assistant" },
      {
        property: "og:description",
        content:
          "A sleek 3D AI assistant studio with Burmese voice input, spoken replies and adaptive mobile, tablet and desktop layouts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "မင်္ဂလာပါ! ကျွန်မ ယမင်း ပါ။ Tap the mic and speak in Burmese or English.",
  time: now(),
};

function Index() {
  const breakpoint = useBreakpoint();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [thinking, setThinking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatVisible, setChatVisible] = useState(true);

  const askYamin = useServerFn(yaminChat);
  const historyRef = useRef<{ role: "user" | "assistant"; content: string }[]>([]);
  const speakRef = useRef<(text: string) => void>(() => {});

  const handleUserText = useCallback(
    (text: string) => {
      setMessages((prev) => [
        ...prev,
        { id: `u-${Date.now()}`, role: "user", text, time: now() },
      ]);
      historyRef.current = [...historyRef.current, { role: "user" as const, content: text }].slice(-12);
      setThinking(true);
      void (async () => {
        let answer: string;
        try {
          const res = await askYamin({ data: { messages: historyRef.current } });
          answer = res.text;
          historyRef.current = [
            ...historyRef.current,
            { role: "assistant" as const, content: answer },
          ].slice(-12);
        } catch (err) {
          console.error(err);
          answer = "တောင်းပန်ပါတယ် — connection မကောင်းဘူးထင်တယ်။ Please try again.";
        }
        setMessages((prev) => [
          ...prev,
          { id: `a-${Date.now()}`, role: "assistant", text: answer, time: now() },
        ]);
        setThinking(false);
        speakRef.current(answer);
      })();
    },
    [askYamin],
  );

  const speech = useSpeech({ muted, onFinalTranscript: handleUserText });
  speakRef.current = speech.speak;


  const status: AssistantStatus = speech.listening
    ? "listening"
    : thinking
      ? "thinking"
      : speech.speaking
        ? "speaking"
        : "online";

  const toggleListening = () => {
    if (speech.listening) speech.stopListening();
    else {
      speech.stopSpeaking();
      speech.startListening();
    }
  };

  const chat = (
    <ChatPanel messages={messages} thinking={thinking} onSend={handleUserText} />
  );

  const controls = (
    <VoiceControls
      listening={speech.listening}
      speaking={speech.speaking}
      muted={muted}
      supported={speech.supported}
      lang="auto"
      onToggleListening={toggleListening}
      onToggleMute={() => setMuted((m) => !m)}
    />
  );

  const viewport = (
    <AvatarViewport
      breakpoint={breakpoint}
      listening={speech.listening}
      speaking={speech.speaking}
      level={speech.level}
      transcript={speech.transcript}
    />
  );

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-aura" />
      <div className="pointer-events-none absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-silk opacity-25 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col gap-3 p-3 sm:gap-4 sm:p-5 lg:p-6">
        <TopBar
          status={status}
          muted={muted}
          onToggleMute={() => setMuted((m) => !m)}
          onReset={() => setMessages([{ ...WELCOME, time: now() }])}
          onToggleLayout={() => setChatVisible((v) => !v)}
          onOpenSettings={() => setDrawerOpen(true)}
        />

        {/* Mobile: single column, tall portrait stage + drawer */}
        <div className="flex min-h-0 flex-1 flex-col gap-4 md:hidden">
          <div className="relative mx-auto w-full max-w-sm flex-1 min-h-[64vh]">
            <div className="absolute inset-0">{viewport}</div>
          </div>
          <div className="pb-24">{controls}</div>
        </div>


        {/* Tablet: tall avatar column with the voice console on the right */}
        <div className="relative hidden min-h-0 flex-1 gap-4 md:flex lg:hidden">
          <div className="min-h-0 min-w-0 flex-[2]">{viewport}</div>
          <aside className="flex min-h-0 w-[240px] shrink-0 flex-col justify-center rounded-2xl glass-panel p-4">
            {controls}
          </aside>
          <AnimatePresence>
            {drawerOpen ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-20 grid place-items-center bg-background/40 p-4 backdrop-blur-sm"
              >
                <motion.div
                  initial={{ scale: 0.95, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  className="h-[70vh] w-full max-w-xl"
                >
                  <div className="flex h-full flex-col gap-2">
                    <button
                      onClick={() => setDrawerOpen(false)}
                      className="ml-auto grid h-11 w-11 place-items-center rounded-xl glass-panel"
                      aria-label="Close chat"
                    >
                      <X className="h-5 w-5" />
                    </button>
                    <div className="min-h-0 flex-1">{chat}</div>
                  </div>
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <button
            onClick={() => setDrawerOpen(true)}
            className="absolute right-4 bottom-4 z-10 grid h-14 w-14 place-items-center rounded-2xl bg-silk text-gold-foreground shadow-glow-gold"
            aria-label="Open chat"
          >
            <MessageCircle className="h-6 w-6" />
          </button>
        </div>

        {/* Desktop: tall avatar stage + right rail (voice console over chat) */}
        <div className="hidden min-h-0 flex-1 gap-5 lg:flex">
          <section className="flex min-h-0 min-w-0 flex-[3] flex-col">
            <div className="min-h-0 flex-1">{viewport}</div>
          </section>
          <motion.aside
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-h-0 w-[38%] max-w-[520px] flex-col gap-4"
          >
            <div className="shrink-0 rounded-2xl glass-panel p-4">{controls}</div>
            {chatVisible ? <div className="min-h-0 flex-1">{chat}</div> : null}
          </motion.aside>
        </div>

      </div>

      {/* Mobile bottom drawer */}
      <div className="md:hidden">
        <AnimatePresence>
          {drawerOpen ? (
            <motion.div
              key="sheet"
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 110) setDrawerOpen(false);
              }}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 26, stiffness: 260 }}
              className="fixed inset-x-0 bottom-0 z-30 h-[78vh] rounded-t-[2rem] glass-panel p-3"
            >
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-foreground/20" />
              <div className="h-[calc(100%-2.25rem)]">{chat}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {!drawerOpen ? (
          <button
            onClick={() => setDrawerOpen(true)}
            className="fixed inset-x-4 bottom-4 z-20 flex items-center justify-center gap-2 rounded-2xl glass-panel py-3 text-sm font-medium"
          >
            <ChevronUp className="h-4 w-4 text-gold" />
            Chat history
          </button>
        ) : null}
      </div>
    </main>
  );
}
