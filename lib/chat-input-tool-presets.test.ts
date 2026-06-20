import { describe, it, expect } from "vitest";
import {
  TOOL_PRESET_LEVELS,
  TOOL_PRESET_LEVEL_TO_VALUE,
  toolPresetValueToLevel,
} from "./chat-input-tool-presets";

describe("chat-input-tool-presets", () => {
  it("keeps the display order off → default → full", () => {
    expect(TOOL_PRESET_LEVELS).toEqual(["off", "default", "full"]);
  });

  it("maps each display level to its preset value", () => {
    expect(TOOL_PRESET_LEVEL_TO_VALUE).toEqual({ off: "none", default: "default", full: "full" });
  });

  it("resolves a preset value back to its display level", () => {
    expect(toolPresetValueToLevel("none")).toBe("off");
    expect(toolPresetValueToLevel("default")).toBe("default");
    expect(toolPresetValueToLevel("full")).toBe("full");
  });

  it("round-trips level → value → level for every level", () => {
    for (const level of TOOL_PRESET_LEVELS) {
      const value = TOOL_PRESET_LEVEL_TO_VALUE[level];
      expect(toolPresetValueToLevel(value)).toBe(level);
    }
  });
});
