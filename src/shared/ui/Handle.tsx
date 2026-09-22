import type { PointerEvent } from "react";

import { GripGlyph } from "./Glyphs.tsx";

export function Handle({ onPointerDown }: { onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="handle m-[calc((var(--touch)-var(--tick))/-2)] flex size-touch flex-none cursor-grab items-center justify-center text-faint touch-none hover:text-dim" aria-label="drag" onPointerDown={onPointerDown}>
      <GripGlyph />
    </button>
  );
}
