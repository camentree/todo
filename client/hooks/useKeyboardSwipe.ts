import { useEffect, useRef, useState } from "react";

import { useKeyboardShortcuts } from "./useKeyboardShortcuts.ts";

const SWIPE_MILLISECONDS = 500;

export interface KeyboardSwipe {
  key: string;
  action: () => void;
}

export function useKeyboardSwipe({
  left,
  right,
  enabled,
}: {
  left: KeyboardSwipe | null;
  right: KeyboardSwipe | null;
  enabled: boolean;
}): { swipingTo: "left" | "right" | null } {
  const [swipingTo, setSwipingTo] = useState<"left" | "right" | null>(
    null,
  );
  const pending = useRef<{
    timer: ReturnType<typeof setTimeout>;
    action: () => void;
  } | null>(null);

  function settle(): void {
    const current = pending.current;
    if (!current) {
      return;
    }
    clearTimeout(current.timer);
    pending.current = null;
    setSwipingTo(null);
    current.action();
  }

  useEffect(() => settle, []);

  function swipeAway(
    direction: "left" | "right",
    action: () => void,
  ): void {
    settle();
    setSwipingTo(direction);
    pending.current = {
      timer: setTimeout(settle, SWIPE_MILLISECONDS),
      action: action,
    };
  }

  useKeyboardShortcuts((event) => {
    if (left && event.key === left.key) {
      swipeAway("left", left.action);
      return;
    }
    if (right && event.key === right.key) {
      swipeAway("right", right.action);
    }
  }, enabled);

  return { swipingTo: swipingTo };
}
