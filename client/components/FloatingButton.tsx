import { Sprite } from "./ui/Sprite.tsx";
import type { SpriteName } from "./ui/Sprite.tsx";

export function FloatingButton({
  icon,
  label,
  onClick,
}: {
  icon: SpriteName;
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="floating">
      <button
        type="button"
        className="bubble primary"
        aria-label={label}
        onClick={onClick}
      >
        <Sprite name={icon} />
      </button>
    </div>
  );
}
