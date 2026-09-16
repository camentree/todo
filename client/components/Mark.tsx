import type { ReactNode } from "react";

export function Mark({ label, count, active, onSelect, children }: { label: string; count: string; active: boolean; onSelect: (() => void) | null; children: ReactNode }) {
  return (
    <button className={active ? "mark on" : "mark"} aria-label={label} disabled={onSelect === null} onClick={onSelect ?? undefined}>
      {count}
      {children}
    </button>
  );
}
