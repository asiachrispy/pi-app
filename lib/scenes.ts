import type { SessionInfo } from "./types";

export type SceneEntryMode = "chat";
export type SceneStatus = "active" | "draft";
export type SceneActionType = "copy" | "export" | "prompt";
export type SceneSourceType = "workspace" | "documents" | "customer_context" | "process";
export type ProductSessionStatus = "active" | "completed" | "draft";

export interface SceneStarter {
  id: string;
  label: string;
  prompt: string;
}

export interface Scene {
  id: string;
  name: string;
  description: string;
  category: string;
  entryMode: SceneEntryMode;
  defaultPrompt: string;
  sourceIds: string[];
  actionIds: string[];
  outputStyle: string;
  suggestedStarters: SceneStarter[];
  status: SceneStatus;
}

export interface SceneAction {
  id: string;
  label: string;
  type: SceneActionType;
  description: string;
  requiresInput: boolean;
  enabled: boolean;
}

export interface SceneSource {
  id: string;
  name: string;
  type: SceneSourceType;
  pathOrRef: string;
  scope: string;
  enabled: boolean;
  description: string;
}

export interface ProductSessionMetadata {
  sceneId: string;
  title: string;
  status: ProductSessionStatus;
  lastResultSummary?: string;
  startedAt: string;
  updatedAt: string;
}

export type ProductSessionMetadataMap = Record<string, ProductSessionMetadata>;

export interface ProductHistoryItem {
  sessionId: string;
  path: string;
  cwd: string;
  sceneId: string | null;
  sceneName: string;
  title: string;
  status: ProductSessionStatus;
  summary: string;
  startedAt: string;
  updatedAt: string;
  messageCount: number;
  firstMessage: string;
}

const ACTIONS: SceneAction[] = [
  {
    id: "copy-result",
    label: "Copy answer",
    type: "copy",
    description: "Copy the latest assistant output.",
    requiresInput: false,
    enabled: true,
  },
  {
    id: "export-result",
    label: "Export result",
    type: "export",
    description: "Save the latest output as a Markdown file.",
    requiresInput: false,
    enabled: true,
  },
  {
    id: "refine-output",
    label: "Refine output",
    type: "prompt",
    description: "Ask for a tighter, more usable version.",
    requiresInput: true,
    enabled: true,
  },
  {
    id: "draft-reply",
    label: "Draft reply",
    type: "prompt",
    description: "Turn context into a customer-ready response.",
    requiresInput: true,
    enabled: true,
  },
  {
    id: "next-step-plan",
    label: "Next-step plan",
    type: "prompt",
    description: "Convert the answer into a short execution checklist.",
    requiresInput: false,
    enabled: true,
  },
];

const SOURCES: SceneSource[] = [
  {
    id: "workspace-files",
    name: "Workspace files",
    type: "workspace",
    pathOrRef: "cwd",
    scope: "selected project directory",
    enabled: true,
    description: "Files available from the selected working directory.",
  },
  {
    id: "business-documents",
    name: "Business documents",
    type: "documents",
    pathOrRef: "user-provided",
    scope: "uploaded or pasted materials",
    enabled: true,
    description: "Policies, reports, notes, and knowledge materials supplied by the user.",
  },
  {
    id: "customer-context",
    name: "Customer context",
    type: "customer_context",
    pathOrRef: "user-provided",
    scope: "pasted customer thread or account notes",
    enabled: true,
    description: "Customer-facing messages, constraints, and desired tone.",
  },
  {
    id: "process-context",
    name: "Process context",
    type: "process",
    pathOrRef: "user-provided",
    scope: "task checklist or operating procedure",
    enabled: true,
    description: "Steps, owners, acceptance criteria, and execution constraints.",
  },
];

const SCENES: Scene[] = [
  {
    id: "enterprise-knowledge",
    name: "Enterprise Knowledge Assistant",
    description: "Answer internal questions with clear context, assumptions, and source-aware caveats.",
    category: "Knowledge",
    entryMode: "chat",
    defaultPrompt: "Answer enterprise knowledge questions using the available workspace and user-provided materials. State assumptions, cite visible file or document references when possible, and keep answers operational.",
    sourceIds: ["workspace-files", "business-documents"],
    actionIds: ["copy-result", "export-result", "next-step-plan"],
    outputStyle: "Direct answer first, then evidence, caveats, and recommended next action.",
    suggestedStarters: [
      { id: "policy-answer", label: "Answer a policy question", prompt: "Answer this internal policy question with source-aware caveats: " },
      { id: "summarize-doc", label: "Summarize a document", prompt: "Summarize the key points, risks, and follow-up actions from this material: " },
      { id: "compare-guidance", label: "Compare guidance", prompt: "Compare these internal references and highlight conflicts or decisions needed: " },
    ],
    status: "active",
  },
  {
    id: "report-generation",
    name: "Report Generation Assistant",
    description: "Create executive-ready reports from rough notes, metrics, and business context.",
    category: "Reports",
    entryMode: "chat",
    defaultPrompt: "Create executive-ready reports from the user's request and available materials. Prefer concise structure, clear headings, decision points, and reusable wording.",
    sourceIds: ["workspace-files", "business-documents"],
    actionIds: ["copy-result", "export-result", "refine-output"],
    outputStyle: "Structured report with title, summary, sections, risks, and next steps.",
    suggestedStarters: [
      { id: "weekly-summary", label: "Weekly business summary", prompt: "Create a weekly business summary from these notes and metrics: " },
      { id: "exec-brief", label: "Executive brief", prompt: "Turn this material into a concise executive brief with decisions and risks: " },
      { id: "project-report", label: "Project report", prompt: "Draft a project status report with progress, blockers, owners, and next steps: " },
    ],
    status: "active",
  },
  {
    id: "customer-communication",
    name: "Customer Communication Assistant",
    description: "Draft customer replies with tone, risk, and follow-up guidance.",
    category: "Communication",
    entryMode: "chat",
    defaultPrompt: "Draft customer-facing communication from the provided context. Keep tone clear, professional, and specific. Highlight risks or missing context before final wording.",
    sourceIds: ["customer-context", "business-documents"],
    actionIds: ["copy-result", "export-result", "draft-reply"],
    outputStyle: "Draft reply, rationale, tone notes, and follow-up checklist.",
    suggestedStarters: [
      { id: "reply-thread", label: "Reply to a thread", prompt: "Draft a customer reply for this conversation: " },
      { id: "deescalate", label: "De-escalate a concern", prompt: "Write a calm response that de-escalates this customer concern: " },
      { id: "renewal-note", label: "Renewal note", prompt: "Draft a renewal or follow-up note from this account context: " },
    ],
    status: "active",
  },
  {
    id: "process-execution",
    name: "Process Execution Assistant",
    description: "Turn operational intent into a clear checklist, execution notes, and reviewable outcomes.",
    category: "Operations",
    entryMode: "chat",
    defaultPrompt: "Help execute structured business processes. Convert goals into steps, identify owners or missing inputs, and produce reviewable outcomes before recommending next actions.",
    sourceIds: ["process-context", "workspace-files"],
    actionIds: ["copy-result", "export-result", "next-step-plan"],
    outputStyle: "Checklist, status table, blockers, and next action.",
    suggestedStarters: [
      { id: "run-checklist", label: "Run a checklist", prompt: "Turn this process into a step-by-step execution checklist: " },
      { id: "handoff-plan", label: "Handoff plan", prompt: "Create a handoff plan with owners, dependencies, and acceptance criteria: " },
      { id: "ops-review", label: "Ops review", prompt: "Review this process result and identify blockers, gaps, and next steps: " },
    ],
    status: "active",
  },
];

export function getScenes(): Scene[] {
  return SCENES.map((scene) => ({ ...scene, suggestedStarters: [...scene.suggestedStarters] }));
}

export function getSceneById(id: string): Scene | null {
  const scene = SCENES.find((item) => item.id === id);
  return scene ? { ...scene, suggestedStarters: [...scene.suggestedStarters] } : null;
}

export function getActionById(id: string): SceneAction | null {
  const action = ACTIONS.find((item) => item.id === id);
  return action ? { ...action } : null;
}

export function getSourceById(id: string): SceneSource | null {
  const source = SOURCES.find((item) => item.id === id);
  return source ? { ...source } : null;
}

export function getActionsForScene(scene: Scene): SceneAction[] {
  return scene.actionIds.flatMap((id) => {
    const action = getActionById(id);
    return action ? [action] : [];
  });
}

export function getSourcesForScene(scene: Scene): SceneSource[] {
  return scene.sourceIds.flatMap((id) => {
    const source = getSourceById(id);
    return source ? [source] : [];
  });
}

export function buildSceneLaunchMessage(scene: Scene, userMessage: string): string {
  const sources = getSourcesForScene(scene)
    .filter((source) => source.enabled)
    .map((source) => `- ${source.name}: ${source.description}`)
    .join("\n");
  const actions = getActionsForScene(scene)
    .filter((action) => action.enabled)
    .map((action) => `- ${action.label}: ${action.description}`)
    .join("\n");

  return [
    `Scene: ${scene.name}`,
    "",
    "Scene purpose:",
    scene.description,
    "",
    "Scene instructions:",
    scene.defaultPrompt,
    "",
    "Output style:",
    scene.outputStyle,
    "",
    "Available context sources:",
    sources || "- User-provided conversation context",
    "",
    "Available user-facing actions:",
    actions || "- Continue the conversation",
    "",
    "User request:",
    userMessage.trim(),
  ].join("\n");
}

export function buildHistoryItems(
  sessions: SessionInfo[],
  metadata: ProductSessionMetadataMap,
): ProductHistoryItem[] {
  return sessions
    .map((session) => {
      const item = metadata[session.id];
      const scene = item ? getSceneById(item.sceneId) : null;
      const title = item?.title || session.name || session.firstMessage || "(untitled work)";
      return {
        sessionId: session.id,
        path: session.path,
        cwd: session.cwd,
        sceneId: item?.sceneId ?? null,
        sceneName: scene?.name ?? "General Chat",
        title,
        status: item?.status ?? "active",
        summary: item?.lastResultSummary ?? session.firstMessage ?? "",
        startedAt: item?.startedAt ?? session.created,
        updatedAt: item?.updatedAt ?? session.modified,
        messageCount: session.messageCount,
        firstMessage: session.firstMessage,
      };
    })
    .sort((a, b) => {
      if (a.sceneId && !b.sceneId) return -1;
      if (!a.sceneId && b.sceneId) return 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}

export function buildMarkdownExport({
  scene,
  title,
  content,
  generatedAt,
}: {
  scene: Scene;
  title: string;
  content: string;
  generatedAt: string;
}): string {
  return [
    `# ${title.trim() || scene.name}`,
    "",
    `Scene: ${scene.name}`,
    `Generated: ${generatedAt}`,
    "",
    content.trim(),
    "",
  ].join("\n");
}

export function titleFromMessage(message: string, fallback: string): string {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return fallback;
  return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
}
