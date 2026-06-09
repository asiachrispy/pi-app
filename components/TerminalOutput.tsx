// components/TerminalOutput.tsx
//
// Renders the terminal scrollback. 6 distinct line-* classes. Auto-scrolls
// to the bottom when the user is within 30px of the bottom; pauses when
// they scroll up. A floating "↓ jump to bottom" button re-enables it.

"use client";

import { useEffect, useRef, useState } from "react";
import type { TerminalLine } from "@/lib/terminal/types";

const AUTOSCROLL_THRESHOLD_PX = 30;

export function TerminalOutput({ lines }: { lines: TerminalLine[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || !autoScroll) return;
    el.scrollTop = el.scrollHeight;
  }, [lines, autoScroll]);

  const onScroll = () => {
    const el = ref.current!;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAutoScroll(distFromBottom < AUTOSCROLL_THRESHOLD_PX);
  };

  return (
    <div ref={ref} className="terminal-output" onScroll={onScroll}>
      {lines.map((line, i) => (
        <Line key={i} line={line} />
      ))}
      {!autoScroll && (
        <button
          className="jump-to-bottom"
          onClick={() => {
            setAutoScroll(true);
            const el = ref.current;
            if (el) el.scrollTop = el.scrollHeight;
          }}
        >
          ↓ jump to bottom
        </button>
      )}
    </div>
  );
}

function Line({ line }: { line: TerminalLine }) {
  switch (line.kind) {
    case "command":
      return <div className="line-cmd">$ {line.text}</div>;
    case "output":
      return <div className={`line-out line-${line.stream}`}>{line.text}</div>;
    case "exit":
      if (line.code === 0) {
        return <div className="line-exit line-exit-ok">[exit 0]</div>;
      }
      return (
        <div className="line-exit line-exit-fail">
          [exit {line.code ?? line.signal ?? "?"}]
        </div>
      );
    case "error":
      return <div className="line-err">⚠ {line.text}</div>;
    case "info":
      return <div className="line-info">· {line.text}</div>;
    case "truncated":
      return <div className="line-info">… {line.droppedBytes} bytes truncated …</div>;
  }
}
