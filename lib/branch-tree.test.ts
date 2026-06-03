import { describe, expect, it } from "vitest";
import type { SessionEntry, SessionTreeNode } from "./types";
import {
  compressBranchNode,
  getFirstForkNode,
  getLinearLeafId,
  hasFork,
} from "./branch-tree";

function messageEntry(id: string, parentId: string | null, text: string): SessionEntry {
  return {
    type: "message",
    id,
    parentId,
    timestamp: "2026-01-01T00:00:00Z",
    message: { role: "user", content: text },
  } as SessionEntry;
}

function node(entry: SessionEntry, children: SessionTreeNode[] = []): SessionTreeNode {
  return { entry, children };
}

describe("branch-tree", () => {
  it("detects forks in branched sessions", () => {
    const tree = [
      node(messageEntry("a", null, "root"), [
        node(messageEntry("b", "a", "mid"), [
          node(messageEntry("c", "b", "left"), []),
          node(messageEntry("d", "b", "right"), []),
        ]),
      ]),
    ];

    expect(hasFork(tree)).toBe(true);
    expect(getFirstForkNode(tree)?.entry.id).toBe("b");
  });

  it("treats linear sessions as having no forks", () => {
    const tree = [
      node(messageEntry("a", null, "one"), [
        node(messageEntry("b", "a", "two"), [
          node(messageEntry("c", "b", "three"), []),
        ]),
      ]),
    ];

    expect(hasFork(tree)).toBe(false);
    expect(getFirstForkNode(tree)).toBeNull();
    expect(getLinearLeafId(tree)).toBe("c");
  });

  it("compresses single-child chains before checking for forks", () => {
    const tree = [
      node(messageEntry("a", null, "root"), [
        node(messageEntry("b", "a", "only-child"), []),
      ]),
    ];

    const compressed = compressBranchNode(tree[0]);
    expect(compressed.node.entry.id).toBe("b");
    expect(compressed.skipped).toBe(1);
  });
});
