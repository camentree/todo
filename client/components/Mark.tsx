import type { ReactNode } from "react";

export function Mark({ label, count, active, onSelect, children }: { label: string; count: string; active: boolean; onSelect: () => void; children: ReactNode }) {
  return (
    <button className={active ? "mark on" : "mark"} aria-label={label} onClick={onSelect}>
      {count}
      {children}
    </button>
  );
}
