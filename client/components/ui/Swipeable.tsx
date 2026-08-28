import type { HTMLAttributes, ReactNode } from "react";

import { Sprite } from "./Sprite.tsx";
import type { SpriteName } from "./Sprite.tsx";
import { useSwipeOrHold } from "../../hooks/useSwipeOrHold.ts";
import { SWIPE_FRACTION } from "../../hooks/usePointerSwipe.ts";

const TARGET_WIDTH = 70;

export interface SwipeAction {
  name: string;
  icon?: SpriteName;
  action: () => void;
}

export function reachedTarget(
  targets: SwipeAction[],
  distance: number,
): number {
  if (targets.length < 2) {
    return 0;
  }
  const uncovered = Math.floor(distance / TARGET_WIDTH);
  return Math.min(Math.max(uncovered - 1, 0), targets.length - 1);
}

export function Swipeable({
  left,
  right = [],
  enabled = true,
  swipingTo = null,
  onLongPress,
  children,
  ...inner
}: {
  left?: SwipeAction;
  right?: SwipeAction[];
  enabled?: boolean;
  swipingTo?: "left" | "right" | null;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement> &
  Partial<Record<`data-${string}`, string | boolean | undefined>>) {
  const aiming = right.length > 1;
  const gesture = useSwipeOrHold({
    onLeft: left?.action,
    onRight:
      right.length > 0
        ? (distance) =>
            right[reachedTarget(right, distance)]?.action()
        : undefined,
    rightLeast: aiming ? TARGET_WIDTH : undefined,
    onLongPress: onLongPress,
    enabled: enabled,
  });

  const travel =
    swipingTo === "left"
      ? -SWIPE_FRACTION * 100
      : SWIPE_FRACTION * 100;
  const shift =
    swipingTo === null ? `${gesture.offset}px` : `${travel}%`;
  const revealing =
    swipingTo ??
    (gesture.offset < 0
      ? "left"
      : gesture.offset > 0
        ? "right"
        : null);
  const uncovered = gesture.offset <= right.length * TARGET_WIDTH;
  const aimedAt = reachedTarget(right, gesture.offset);
  const committing = right[aimedAt];

  return (
    <div className="swipe-track">
      <div className="swipe-band">
        {revealing === "left" && left && (
          <div className="swipe-action archive">{left.name}</div>
        )}

        {revealing === "right" &&
          committing &&
          (aiming && uncovered && swipingTo === null ? (
            <div className="swipe-targets">
              {right.map((target, index) => (
                <span
                  key={target.name}
                  className="swipe-target"
                  data-on={index === aimedAt}
                >
                  {target.icon && <Sprite name={target.icon} />}
                  {target.name}
                </span>
              ))}
            </div>
          ) : (
            <div className="swipe-action defer">
              {committing.icon && <Sprite name={committing.icon} />}
              {committing.name}
            </div>
          ))}

        <div
          {...inner}
          ref={gesture.ref}
          data-swiping={gesture.swiping}
          style={{ transform: `translateX(${shift})` }}
          onPointerDown={gesture.down}
          onPointerMove={gesture.move}
          onPointerUp={gesture.up}
          onPointerCancel={gesture.up}
          onClickCapture={(event) => {
            if (gesture.travelled()) {
              event.stopPropagation();
              event.preventDefault();
            }
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
