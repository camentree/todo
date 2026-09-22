import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent, RefObject } from "react";

const swipeFraction = 0.4;
const commitDistance = 12;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  committed: boolean;
  offset: number;
}

export interface SwipeHandlers {
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
  onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
}

export function useSwipe({
  element,
  rightAllowed,
  leftAllowed,
  onRight,
  onLeft,
}: {
  element: RefObject<HTMLDivElement | null>;
  rightAllowed: boolean;
  leftAllowed: boolean;
  onRight: () => void;
  onLeft: () => void;
}): { offset: number; settling: boolean; handlers: SwipeHandlers; onSettled: () => void } {
  const gesture = useRef<Gesture | null>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const springBack = () => {
    setSettling(true);
    setOffset(0);
  };

  const onPointerCancel = () => {
    gesture.current = null;
    springBack();
  };

  return {
    offset,
    settling,
    onSettled: () => setSettling(false),
    handlers: {
      onPointerDown: (event) => {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        event.stopPropagation();
        gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, committed: false, offset: 0 };
        setSettling(false);
      },
      onPointerMove: (event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        const dx = event.clientX - current.startX;
        const dy = event.clientY - current.startY;
        if (!current.committed) {
          if (Math.abs(dy) > commitDistance && Math.abs(dy) >= Math.abs(dx)) {
            gesture.current = null;
            return;
          }
          if (Math.abs(dx) < commitDistance) return;
          current.committed = true;
          event.currentTarget.setPointerCapture(event.pointerId);
        }
        const allowed = dx > 0 ? rightAllowed : leftAllowed;
        current.offset = allowed ? dx : 0;
        setOffset(current.offset);
      },
      onPointerUp: (event) => {
        const current = gesture.current;
        if (!current || current.pointerId !== event.pointerId) return;
        gesture.current = null;
        if (!current.committed) return;
        const enough = (element.current?.offsetWidth ?? 0) * swipeFraction;
        if (current.offset >= enough && rightAllowed) onRight();
        else if (current.offset <= -enough && leftAllowed) onLeft();
        springBack();
      },
      onPointerCancel,
      onLostPointerCapture: (event) => {
        if (event.target === event.currentTarget && gesture.current?.committed) onPointerCancel();
      },
      onClickCapture: (event) => {
        if (offset !== 0 || settling) {
          event.stopPropagation();
          event.preventDefault();
        }
      },
    },
  };
}
