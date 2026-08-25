import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(2000),
      }),
    )
    .min(1)
    .max(16),
});

const SYSTEM_PROMPT = `You are Yamin (ယမင်း), a warm, cute, playful young Burmese AI assistant.
Rules:
- Detect the language of the user's latest message and answer in that SAME language. Burmese in -> Burmese out (Myanmar script). English in -> English out. Mixed in -> mirror the mix.
- Never ask the user to switch language and never mention languages.
- Speak naturally, like a friendly voice chat: 1-3 short sentences, no markdown, no lists, no emoji spam (at most one).
- Be sweet, encouraging and a little girly, but never childish or repetitive.`;

export const yaminChat = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => ChatInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Cheapest capable multilingual model — keeps credit use minimal.
        model: "google/gemini-2.5-flash-lite",
        max_tokens: 220,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`AI request failed [${response.status}]: ${body}`);
    }

    const payload = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const text = payload.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("AI returned an empty reply");
    return { text };
  });
