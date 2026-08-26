import type { ReactNode } from "react";

import { Sprite } from "./Sprite.tsx";

export function Collapsible({
  tone,
  label,
  badge,
  open,
  onToggle,
  children,
}: {
  tone: "group" | "section";
  label: ReactNode;
  badge?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {label ? (
        <button
          type="button"
          className="section-head"
          data-tone={tone}
          onClick={onToggle}
        >
          <Sprite name="chevron" open={open} />
          <span className="section-name">{label}</span>
          {badge}
        </button>
      ) : null}
      <div className="collapsible" data-open={open}>
        <div>{children}</div>
      </div>
    </>
  );
}
