import { useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

const DRAG_TO_CLOSE = 110;

function fromTheHandle(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(".info-handle") !== null
  );
}

function handlesItsOwnScrolling(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest("textarea, .info-comments, .info-subtasks") !==
      null
  );
}

export function useDragDown({
  scroller,
  onRelease,
}: {
  scroller: RefObject<HTMLDivElement | null>;
  onRelease: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const startY = useRef<number | null>(null);
  const distance = useRef(0);
  const pulling = useRef(false);

  useEffect(() => {
    const node = scroller.current;
    if (!node) {
      return;
    }
    function holdTheScroll(event: TouchEvent): void {
      if (pulling.current) {
        event.preventDefault();
      }
    }
    node.addEventListener("touchmove", holdTheScroll, {
      passive: false,
    });
    return () => node.removeEventListener("touchmove", holdTheScroll);
  }, [scroller]);

  return {
    offset: offset,
    dragging: startY.current !== null,
    slideOut: () => setOffset(window.innerHeight),
    start: (event: PointerEvent) => {
      if (handlesItsOwnScrolling(event.target)) {
        startY.current = null;
        return;
      }
      startY.current = event.clientY;
      distance.current = 0;
      pulling.current = fromTheHandle(event.target);
    },
    move: (event: PointerEvent) => {
      if (startY.current === null) {
        return;
      }

      if (!pulling.current) {
        const atTop = (scroller.current?.scrollTop ?? 0) <= 0;
        if (!atTop || event.clientY - startY.current <= 4) {
          return;
        }
        pulling.current = true;
        startY.current = event.clientY;
      }

      const travelled = event.clientY - startY.current;
      if (travelled <= 0) {
        distance.current = 0;
        setOffset(0);
        return;
      }
      distance.current = travelled;
      setOffset(travelled);
    },
    end: () => {
      if (startY.current === null) {
        return;
      }
      const travelled = distance.current;
      startY.current = null;
      distance.current = 0;
      pulling.current = false;
      if (travelled >= DRAG_TO_CLOSE) {
        onRelease();
      } else {
        setOffset(0);
      }
    },
  };
}
