import type { ReactNode } from "react";

import { mergeClasses } from "./mergeClasses.ts";

export function RoundButton({ className, label, onSelect, children }: { className?: string; label: string; onSelect: () => void; children: ReactNode }) {
  return (
    <button
      className={mergeClasses("round flex size-round flex-none items-center justify-center rounded-full bg-accent text-ground", className)}
      aria-label={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onSelect}
    >
      {children}
    </button>
  );
}
