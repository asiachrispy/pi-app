import { useState, useCallback } from "react";

// pi-app 专属：底部终端抽屉的开合 / 高度状态。
// 从 AppShell 上帝组件抽出，隔离 pi-app 独有的终端面板逻辑（pi-web 上游无终端）。

export interface TerminalPanelState {
  /** 抽屉是否展开。 */
  open: boolean;
  /** 抽屉高度占比 (0–1)。 */
  height: number;
  setHeight: (height: number) => void;
  /** 切换展开/收起。 */
  toggle: () => void;
  /** 收起抽屉。 */
  close: () => void;
}

export function useTerminalPanel(initialHeight = 0.4): TerminalPanelState {
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(initialHeight);

  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return { open, height, setHeight, toggle, close };
}
