import type { ReactNode } from "react";

export function RoundButton({ label, onSelect, children }: { label: string; onSelect: () => void; children: ReactNode }) {
  return (
    <button className="round" aria-label={label} onClick={onSelect}>
      {children}
    </button>
  );
}
