import type { MouseEvent } from "react";

import { TickGlyph } from "./Glyphs.tsx";

export function SquareTick({ on, onToggle }: { on: boolean; onToggle: (event: MouseEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="square m-[calc((var(--touch)-var(--tick))/-2)] flex size-touch flex-none items-center justify-center" aria-label={on ? "deselect" : "select"} onClick={onToggle}>
      <span className={"flex size-tick items-center justify-center rounded-[28%] border-[1.5px] text-ground " + (on ? "border-accent bg-accent" : "border-faint")}>{on && <TickGlyph size={12} />}</span>
    </button>
  );
}
