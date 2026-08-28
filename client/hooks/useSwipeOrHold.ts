import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { usePointerSwipe } from "./usePointerSwipe.ts";
import { trace } from "../data/trace.ts";

const LONG_PRESS_MILLISECONDS = 600;

export function useSwipeOrHold({
  onLeft,
  onRight,
  rightLeast,
  onLongPress,
  enabled,
}: {
  onLeft?: () => void;
  onRight?: (distance: number) => void;
  rightLeast?: number;
  onLongPress?: (pointerX: number, pointerY: number) => void;
  enabled: boolean;
}) {
  const swipe = usePointerSwipe({
    onLeft: onLeft,
    onRight: onRight,
    rightLeast: rightLeast,
    enabled: enabled,
  });
  const holding = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => {
    const node = swipe.ref.current;
    if (!node) {
      return;
    }
    function holdTheScroll(event: TouchEvent): void {
      if (holding.current) {
        event.preventDefault();
      }
    }
    node.addEventListener("touchmove", holdTheScroll, {
      passive: false,
    });
    return () => node.removeEventListener("touchmove", holdTheScroll);
  }, []);

  useEffect(() => {
    return () => stopTimer();
  }, []);

  function stopTimer(): void {
    stopWatching.current?.();
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function watchForRelease(pointerId: number): void {
    function onRelease(event: PointerEvent): void {
      if (event.pointerId === pointerId) {
        stopTimer();
      }
    }
    window.addEventListener("pointerup", onRelease);
    window.addEventListener("pointercancel", onRelease);
    stopWatching.current = () => {
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      stopWatching.current = null;
    };
  }

  return {
    ref: swipe.ref,
    offset: swipe.offset,
    swiping: swipe.swiping,
    travelled: swipe.travelled,
    down: (event: ReactPointerEvent) => {
      holding.current = false;
      swipe.down(event);
      if (!enabled || !onLongPress) {
        return;
      }
      const pointerX = event.clientX;
      const pointerY = event.clientY;
      watchForRelease(event.pointerId);
      timer.current = setTimeout(() => {
        trace("long press fired, dragging now");
        holding.current = true;
        onLongPress(pointerX, pointerY);
      }, LONG_PRESS_MILLISECONDS);
    },
    move: (event: ReactPointerEvent) => {
      if (holding.current) {
        return;
      }
      swipe.move(event);
      if (swipe.travelled()) {
        stopTimer();
      }
    },
    up: () => {
      stopTimer();
      if (holding.current) {
        holding.current = false;
        swipe.cancel();
        return;
      }
      swipe.up();
    },
  };
}
