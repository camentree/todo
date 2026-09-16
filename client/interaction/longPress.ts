import type { PointerEvent, MouseEvent } from "react";

export interface PressHandlers {
  onPointerDown: (event: PointerEvent) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerMove: (event: PointerEvent) => void;
  onClickCapture: (event: MouseEvent) => void;
}

let fired = false;

export function longPress(onLong: () => void): PressHandlers {
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;
  const cancel = () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = null;
  };
  return {
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      fired = false;
      startX = event.clientX;
      startY = event.clientY;
      cancel();
      timer = window.setTimeout(() => {
        fired = true;
        onLong();
      }, 480);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerMove: (event) => {
      if (Math.abs(event.clientX - startX) > 8 || Math.abs(event.clientY - startY) > 8) cancel();
    },
    onClickCapture: (event) => {
      if (!fired) return;
      event.stopPropagation();
      event.preventDefault();
      fired = false;
    },
  };
}
