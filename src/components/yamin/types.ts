export type AssistantStatus = "online" | "listening" | "thinking" | "speaking";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  time: string;
};
