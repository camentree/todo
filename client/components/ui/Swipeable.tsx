import type { HTMLAttributes, ReactNode } from "react";

import { useSwipeOrHold } from "../../hooks/useSwipeOrHold.ts";
import { SWIPE_FRACTION } from "../../hooks/usePointerSwipe.ts";

export interface SwipeAction {
  name: string;
  action: () => void;
}

export function Swipeable({
  left,
  right,
  enabled = true,
  swipingTo = null,
  onLongPress,
  children,
  ...inner
}: {
  left?: SwipeAction;
  right?: SwipeAction;
  enabled?: boolean;
  swipingTo?: "left" | "right" | null;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement> &
  Partial<Record<`data-${string}`, string | boolean | undefined>>) {
  const gesture = useSwipeOrHold({
    onLeft: left?.action,
    onRight: right?.action,
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

  return (
    <div className="swipe-track">
      <div className="swipe-band">
        {revealing === "left" && left && (
          <div className="swipe-action archive">{left.name}</div>
        )}
        {revealing === "right" && right && (
          <div className="swipe-action defer">{right.name}</div>
        )}

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
