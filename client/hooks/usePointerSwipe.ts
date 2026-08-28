import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { trace } from "../data/trace.ts";

const CAPTURE_AFTER = 16;
const MOVED_AT_ALL = 20;
const GIVE_UP_VERTICAL = 10;

export const SWIPE_FRACTION = 0.4;

export function usePointerSwipe({
  onLeft,
  onRight,
  rightLeast,
  enabled = true,
}: {
  onLeft?: () => void;
  onRight?: (distance: number) => void;
  rightLeast?: number;
  enabled?: boolean;
}) {
  const [offset, setOffset] = useState(0);
  const element = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sideways = useRef(0);
  const furthest = useRef(0);
  const active = useRef(false);
  const stopWatching = useRef<(() => void) | null>(null);
  const endLatest = useRef<() => void>(() => {});

  useEffect(() => {
    return () => stopWatching.current?.();
  }, []);

  useEffect(() => {
    endLatest.current = end;
  });

  function watchForRelease(
    pointerId: number,
    finish: () => void,
  ): void {
    stopWatching.current?.();

    function onPointerRelease(event: PointerEvent): void {
      if (event.pointerId === pointerId) {
        finish();
      }
    }
    function onWindowBlur(): void {
      finish();
    }

    window.addEventListener("pointerup", onPointerRelease);
    window.addEventListener("pointercancel", onPointerRelease);
    window.addEventListener("blur", onWindowBlur);
    stopWatching.current = () => {
      window.removeEventListener("pointerup", onPointerRelease);
      window.removeEventListener("pointercancel", onPointerRelease);
      window.removeEventListener("blur", onWindowBlur);
      stopWatching.current = null;
    };
  }

  function cancel(): void {
    active.current = false;
    stopWatching.current?.();
    start.current = null;
    sideways.current = 0;
    setOffset(0);
  }

  function end(): void {
    if (!active.current) {
      return;
    }
    const distance = sideways.current;
    const enough =
      (element.current?.offsetWidth ?? 0) * SWIPE_FRACTION;
    cancel();
    if (distance <= -enough) {
      onLeft?.();
      return;
    }
    if (distance >= (rightLeast ?? enough)) {
      onRight?.(distance);
    }
  }

  return {
    ref: element,
    offset: offset,
    swiping: offset !== 0,
    travelled: () => furthest.current > MOVED_AT_ALL,
    down: (event: ReactPointerEvent) => {
      trace("pointer down", {
        enabled: enabled,
        on: (event.target as HTMLElement).className,
        pointerType: event.pointerType,
      });
      if (!enabled) {
        return;
      }
      active.current = true;
      watchForRelease(event.pointerId, () => endLatest.current());
      start.current = { x: event.clientX, y: event.clientY };
      sideways.current = 0;
      furthest.current = 0;
    },
    move: (event: ReactPointerEvent) => {
      if (!start.current) {
        return;
      }
      const acrossNow = event.clientX - start.current.x;
      const downNow = event.clientY - start.current.y;
      furthest.current = Math.max(
        furthest.current,
        Math.abs(acrossNow),
        Math.abs(downNow),
      );

      if (
        Math.abs(downNow) > GIVE_UP_VERTICAL &&
        Math.abs(downNow) > Math.abs(acrossNow)
      ) {
        trace("gave up, looks vertical", {
          down: Math.round(downNow),
          across: Math.round(acrossNow),
        });
        cancel();
        return;
      }

      const hasAction =
        acrossNow < 0 ? Boolean(onLeft) : Boolean(onRight);
      const across = hasAction ? acrossNow : 0;

      if (
        hasAction &&
        Math.abs(across) > CAPTURE_AFTER &&
        !event.currentTarget.hasPointerCapture(event.pointerId)
      ) {
        trace("captured the pointer", { across: Math.round(across) });
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      sideways.current = across;
      setOffset(across);
    },
    up: () => end(),
    cancel: cancel,
  };
}
