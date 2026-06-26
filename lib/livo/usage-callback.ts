import type { UsageLedgerEvent } from "@/lib/livo/record-usage";

export type LivoUsageCallbackInput = Pick<
  UsageLedgerEvent,
  | "tenantId"
  | "sessionId"
  | "model"
  | "provider"
  | "inputTokens"
  | "outputTokens"
  | "cacheReadTokens"
  | "cacheWriteTokens"
  | "totalCost"
  | "ts"
>;

export function shouldNotifyLivoUsage(
  input: LivoUsageCallbackInput,
): input is LivoUsageCallbackInput & { tenantId: string; sessionId: string } {
  return (
    typeof input.tenantId === "string"
    && input.tenantId.trim().length > 0
    && typeof input.sessionId === "string"
    && input.sessionId.trim().length > 0
  );
}

export function isLivoUsageCallbackEnabled(): boolean {
  return process.env.PI_LIVO_USAGE_CALLBACK_ENABLED === "1";
}

/** M4：增量 token 用量回调 Livo Backend（由 Livo 落 Supabase，Pi 不直连 PG）。 */
export async function notifyLivoTokenUsage(input: LivoUsageCallbackInput): Promise<boolean> {
  if (!isLivoUsageCallbackEnabled()) return false;

  const baseUrl = process.env.PI_LIVO_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.PI_WEB_REMOTE_TOKEN;
  if (!baseUrl || !token || !shouldNotifyLivoUsage(input)) {
    return false;
  }

  const response = await fetch(`${baseUrl}/pi-agent/callbacks/usage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: input.tenantId,
      piSessionId: input.sessionId,
      model: input.model,
      provider: input.provider,
      inputTokens: input.inputTokens,
      outputTokens: input.outputTokens,
      cacheReadTokens: input.cacheReadTokens,
      cacheWriteTokens: input.cacheWriteTokens,
      totalCost: input.totalCost,
      recordedAt: input.ts,
    }),
  });

  return response.ok;
}
