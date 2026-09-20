import type { ReactNode } from "react";

import type { PressHandlers } from "../interaction/longPress.ts";

export function TextButton({ active, warn, onSelect, press, children }: { active: boolean; warn?: boolean; onSelect: () => void; press?: PressHandlers | null; children: ReactNode }) {
  return (
    <button className={warn ? "text warn" : active ? "text active" : "text"} onMouseDown={(event) => event.preventDefault()} onClick={onSelect} {...press}>
      {children}
    </button>
  );
}
