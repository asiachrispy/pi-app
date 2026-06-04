import type { AgentMessage, AssistantMessage, ImageContent, TextContent } from "./types";

type PublicMessage = AgentMessage;

function isPublicAssistantBlock(block: unknown): block is TextContent | ImageContent {
  if (!block || typeof block !== "object") return false;
  const type = (block as { type?: unknown }).type;
  return type === "text" || type === "image";
}

export function buildSharedConversationMessages(
  messages: AgentMessage[],
  entryIds: string[],
): { messages: PublicMessage[]; entryIds: string[] } {
  const sharedMessages: PublicMessage[] = [];
  const sharedEntryIds: string[] = [];

  messages.forEach((message, index) => {
    if (message.role === "user" || message.role === "timelineSummary") {
      sharedMessages.push(message);
      sharedEntryIds.push(entryIds[index] ?? "");
      return;
    }

    if (message.role === "assistant") {
      const assistant = message as AssistantMessage;
      sharedMessages.push({
        role: "assistant",
        content: (assistant.content ?? []).filter(isPublicAssistantBlock),
        model: assistant.model,
        provider: assistant.provider,
        stopReason: assistant.stopReason,
        errorMessage: assistant.errorMessage,
        timestamp: assistant.timestamp,
      });
      sharedEntryIds.push(entryIds[index] ?? "");
    }
  });

  return { messages: sharedMessages, entryIds: sharedEntryIds };
}
