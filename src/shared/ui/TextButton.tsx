import type { ReactNode } from "react";

import type { PressHandlers } from "../longPress.ts";
import { mergeClasses } from "./mergeClasses.ts";

export function TextButton({ className, onSelect, press, children }: { className?: string; onSelect: () => void; press?: PressHandlers | null; children: ReactNode }) {
  return (
    <button className={mergeClasses("text", className)} onMouseDown={(event) => event.preventDefault()} onClick={onSelect} {...press}>
      {children}
    </button>
  );
}
