import type { ToolMode } from "@/lib/pi-web-preferences";

export interface ToolEntry {
  name: string;
  description: string;
  active: boolean;
}

export type ToolPreset = "none" | "default" | "full";

export const PRESET_NONE: string[] = [];
export const PRESET_DEFAULT: string[] = ["read", "bash", "edit", "write"];
export const PRESET_FULL: string[] = ["bash", "read", "edit", "write", "grep", "find", "ls"];

const BUILTIN_TOOL_NAMES = new Set(PRESET_FULL);

export function getPresetFromTools(tools: ToolEntry[]): ToolPreset {
  const activeTools = tools.filter((t) => t.active);
  if (activeTools.length === 0) return "none";

  const active = activeTools
    .map((t) => t.name)
    .filter((name) => BUILTIN_TOOL_NAMES.has(name))
    .sort()
    .join(",");

  if (active === [...PRESET_DEFAULT].sort().join(",")) return "default";
  if (active === [...PRESET_FULL].sort().join(",")) return "full";
  return "default";
}

export function getToolNamesForPreset(preset: ToolPreset): string[] {
  if (preset === "none") return [...PRESET_NONE];
  if (preset === "full") return [...PRESET_FULL];
  return [...PRESET_DEFAULT];
}

export function toolModeToPreset(mode: ToolMode): ToolPreset {
  if (mode === "full") return "full";
  if (mode === "default") return "default";
  return "default";
}

export function toolModeToToolNames(mode: ToolMode): string[] {
  if (mode === "full") return PRESET_FULL;
  if (mode === "default") return PRESET_DEFAULT;
  if (mode === "simple") return PRESET_DEFAULT;
  return PRESET_NONE;
}

export function presetToToolMode(preset: ToolPreset, currentMode: ToolMode): ToolMode {
  if (preset === "full") return "full";
  if (preset === "none") return currentMode === "simple" ? "simple" : "default";
  return currentMode === "simple" ? "simple" : "default";
}
