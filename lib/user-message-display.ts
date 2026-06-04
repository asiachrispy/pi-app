import type { TextContent, UserMessage } from "@/lib/types";
import { stripFileRefsForDisplay, type FilePathRef } from "@/lib/message-file-refs";

/** Matches pi-coding-agent `parseSkillBlock` user-message format. */
const SKILL_BLOCK_RE =
  /^<skill name="([^"]+)" location="[^"]*">\n[\s\S]*?\n<\/skill>(?:\n\n([\s\S]+))?$/;

const SLASH_SKILL_RE = /^\/skill:([\w.-]+)$/;

/** Collapse expanded skill payloads to a short label for the chat UI. */
export function displayUserMessageText(raw: string): string {
  const trimmed = raw.trim();
  if (SLASH_SKILL_RE.test(trimmed)) {
    return trimmed;
  }
  const block = trimmed.match(SKILL_BLOCK_RE);
  if (block) {
    const trailing = block[2]?.trim();
    if (trailing) return stripFileRefsForDisplay(trailing).text;
    return `/skill:${block[1]}`;
  }
  return stripFileRefsForDisplay(raw).text;
}

export function displayUserMessageFilePaths(content: UserMessage["content"]): FilePathRef[] {
  const raw = extractUserMessageText(content);
  return stripFileRefsForDisplay(raw).refs;
}

export function extractUserMessageText(content: UserMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

export function displayUserMessageContent(content: UserMessage["content"]): string {
  return displayUserMessageText(extractUserMessageText(content));
}
