import { TickGlyph } from "./Glyphs.tsx";

export function SquareTick({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button className={on ? "square on" : "square"} aria-label={on ? "deselect" : "select"} onClick={onToggle}>
      <span>{on && <TickGlyph size={12} />}</span>
    </button>
  );
}
