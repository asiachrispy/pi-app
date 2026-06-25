export type LivoPiStatus = "running" | "failed" | "completed";

export type LivoTodoStatusItem = {
  todoId?: unknown;
  title?: unknown;
  status?: unknown;
  message?: unknown;
  outputPath?: unknown;
};

export type LivoStatusCallbackInput = {
  userId?: unknown;
  meetingId?: unknown;
  piSessionId?: unknown;
  status: LivoPiStatus;
  message?: string;
  items?: LivoTodoStatusItem[];
};

export function shouldNotifyLivo(input: LivoStatusCallbackInput): input is {
  userId: string;
  meetingId: string;
  piSessionId: string;
  status: LivoPiStatus;
  message?: string;
  items?: LivoTodoStatusItem[];
} {
  return (
    typeof input.userId === "string" &&
    input.userId.trim().length > 0 &&
    typeof input.meetingId === "string" &&
    input.meetingId.trim().length > 0 &&
    typeof input.piSessionId === "string" &&
    input.piSessionId.trim().length > 0
  );
}

export async function notifyLivoPiStatus(input: LivoStatusCallbackInput) {
  const baseUrl = process.env.PI_LIVO_BASE_URL?.replace(/\/+$/, "");
  const token = process.env.PI_WEB_REMOTE_TOKEN;
  if (!baseUrl || !token || !shouldNotifyLivo(input)) {
    return false;
  }

  const response = await fetch(`${baseUrl}/pi-agent/callbacks/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      userId: input.userId,
      meetingId: input.meetingId,
      piSessionId: input.piSessionId,
      status: input.status,
      message: input.message,
      items: input.items,
    }),
  });

  return response.ok;
}
