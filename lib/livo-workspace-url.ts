export function buildLivoWorkspaceResolvePath(workspaceId: string, meetingId?: string | null): string {
  const params = new URLSearchParams({ workspace: workspaceId });
  if (meetingId) params.set("meeting", meetingId);
  return `/api/livo/workspace/resolve?${params.toString()}`;
}
