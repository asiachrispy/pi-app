// pi-app 专属：ChatInput 工具档位下拉的「展示档位 ↔ preset 值」映射。
// 从 ChatInput.tsx 内联常量抽出，便于单元测试与复用（pi-web 上游 ChatInput 无此 UI）。

export type ToolPresetLevel = "off" | "default" | "full";
export type ToolPresetValue = "none" | "default" | "full";

/** 下拉中展示的档位顺序。 */
export const TOOL_PRESET_LEVELS: readonly ToolPresetLevel[] = ["off", "default", "full"] as const;

/** 展示档位 → 对外的 preset 值。 */
export const TOOL_PRESET_LEVEL_TO_VALUE: Record<ToolPresetLevel, ToolPresetValue> = {
  off: "none",
  default: "default",
  full: "full",
};

/** preset 值 → 展示档位（用于回显当前选中项）。未知值返回 undefined。 */
export function toolPresetValueToLevel(value: ToolPresetValue): ToolPresetLevel | undefined {
  return (Object.entries(TOOL_PRESET_LEVEL_TO_VALUE) as [ToolPresetLevel, ToolPresetValue][])
    .find(([, v]) => v === value)?.[0];
}
