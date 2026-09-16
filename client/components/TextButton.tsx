import type { ReactNode } from "react";

import type { PressHandlers } from "../interaction/longPress.ts";

export function TextButton({ active, onSelect, press, children }: { active: boolean; onSelect: () => void; press?: PressHandlers | null; children: ReactNode }) {
  return (
    <button className={active ? "text active" : "text"} onClick={onSelect} {...press}>
      {children}
    </button>
  );
}
