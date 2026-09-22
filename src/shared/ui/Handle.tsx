import type { PointerEvent } from "react";

import { GripGlyph } from "./Glyphs.tsx";

export function Handle({ onPointerDown }: { onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void }) {
  return (
    <button className="handle" aria-label="drag" onPointerDown={onPointerDown}>
      <GripGlyph />
    </button>
  );
}
