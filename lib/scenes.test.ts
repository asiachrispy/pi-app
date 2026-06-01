import { describe, expect, it } from "vitest";
import type { SessionInfo } from "./types";
import {
  buildHistoryItems,
  buildMarkdownExport,
  buildSceneLaunchMessage,
  getActionById,
  getSceneById,
  getScenes,
} from "./scenes";

describe("scene domain configuration", () => {
  it("defines the first-release business scenes with distinct framing", () => {
    const scenes = getScenes();

    expect(scenes.map((scene) => scene.id)).toEqual([
      "enterprise-knowledge",
      "report-generation",
      "customer-communication",
      "process-execution",
    ]);
    expect(getSceneById("enterprise-knowledge")).toMatchObject({
      name: "Enterprise Knowledge Assistant",
      entryMode: "chat",
      status: "active",
    });
    expect(getSceneById("report-generation")?.suggestedStarters.length).toBeGreaterThanOrEqual(3);
    expect(getSceneById("missing")).toBeNull();
  });

  it("keeps scene actions user-facing and enabled through action ids", () => {
    const knowledge = getSceneById("enterprise-knowledge");
    expect(knowledge).not.toBeNull();

    const actions = knowledge!.actionIds.map((id) => getActionById(id));

    expect(actions.every(Boolean)).toBe(true);
    expect(actions.map((action) => action?.label)).toContain("Copy answer");
    expect(actions.map((action) => action?.label)).toContain("Export result");
    expect(actions.every((action) => action?.enabled)).toBe(true);
  });
});

describe("scene launch mapping", () => {
  it("wraps a user request with scene purpose, output style, sources, and actions", () => {
    const scene = getSceneById("report-generation");
    expect(scene).not.toBeNull();

    const message = buildSceneLaunchMessage(scene!, "Create a weekly sales summary.");

    expect(message).toContain("Scene: Report Generation Assistant");
    expect(message).toContain("Create executive-ready reports");
    expect(message).toContain("Output style:");
    expect(message).toContain("Create a weekly sales summary.");
    expect(message).toContain("Available user-facing actions:");
  });
});

describe("scene history and export helpers", () => {
  it("maps runtime sessions to business-facing history records", () => {
    const sessions: SessionInfo[] = [
      {
        id: "s1",
        path: "/tmp/s1.jsonl",
        cwd: "/work",
        created: "2026-06-01T10:00:00.000Z",
        modified: "2026-06-01T10:05:00.000Z",
        messageCount: 4,
        firstMessage: "What changed in policy?",
      },
      {
        id: "s2",
        path: "/tmp/s2.jsonl",
        cwd: "/work",
        created: "2026-06-01T11:00:00.000Z",
        modified: "2026-06-01T11:10:00.000Z",
        messageCount: 2,
        firstMessage: "Draft a report",
      },
    ];

    const items = buildHistoryItems(sessions, {
      s1: {
        sceneId: "enterprise-knowledge",
        title: "Policy Q&A",
        status: "completed",
        lastResultSummary: "Answered with source guidance",
        startedAt: "2026-06-01T10:00:00.000Z",
        updatedAt: "2026-06-01T10:08:00.000Z",
      },
    });

    expect(items[0]).toMatchObject({
      sessionId: "s1",
      sceneId: "enterprise-knowledge",
      sceneName: "Enterprise Knowledge Assistant",
      title: "Policy Q&A",
      status: "completed",
      summary: "Answered with source guidance",
    });
    expect(items[1]).toMatchObject({
      sessionId: "s2",
      sceneId: null,
      sceneName: "General Chat",
      title: "Draft a report",
      status: "active",
    });
  });

  it("exports scene results as markdown with business context", () => {
    const scene = getSceneById("enterprise-knowledge");
    expect(scene).not.toBeNull();

    const markdown = buildMarkdownExport({
      scene: scene!,
      title: "Policy answer",
      content: "Employees can request access through the service desk.",
      generatedAt: "2026-06-01T12:00:00.000Z",
    });

    expect(markdown).toContain("# Policy answer");
    expect(markdown).toContain("Scene: Enterprise Knowledge Assistant");
    expect(markdown).toContain("Employees can request access");
  });
});
