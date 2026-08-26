import type { ReactNode } from "react";

import { Sprite } from "./Sprite.tsx";
import type { SpriteName } from "./Sprite.tsx";

export function MenuButton({
  icon,
  label,
  active,
  badge,
  onToggle,
}: {
  icon: SpriteName;
  label: string;
  active?: boolean;
  badge?: ReactNode;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="icon-button"
      aria-label={label}
      data-active={active}
      onClick={onToggle}
    >
      <Sprite name={icon} />
      {badge}
    </button>
  );
}
