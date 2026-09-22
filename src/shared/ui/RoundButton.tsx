import type { ReactNode } from "react";

export function RoundButton({ label, onSelect, children }: { label: string; onSelect: () => void; children: ReactNode }) {
  return (
    <button className="round flex size-round flex-none items-center justify-center rounded-full bg-accent text-ground" aria-label={label} onMouseDown={(event) => event.preventDefault()} onClick={onSelect}>
      {children}
    </button>
  );
}
