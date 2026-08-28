import { Sprite } from "./ui/Sprite.tsx";
import type { SpriteName } from "./ui/Sprite.tsx";

export function FloatingButton({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: SpriteName;
  label: string;
  tone: "adding" | "leaving" | "undoing";
  onClick: () => void;
}) {
  return (
    <div className="floating">
      <button
        type="button"
        className="bubble"
        data-tone={tone}
        aria-label={label}
        onClick={onClick}
      >
        <Sprite name={icon} />
      </button>
    </div>
  );
}
