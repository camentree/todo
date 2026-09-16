import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";

export const swipeThreshold = 96;
const commitDistance = 12;
const driftLimit = 28;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  committed: boolean;
  offset: number;
}

export function Swipeable({ onRight, onLeft, children }: { onRight: (() => void) | null; onLeft: (() => void) | null; children: ReactNode }) {
  const gesture = useRef<Gesture | null>(null);
  const [offset, setOffset] = useState(0);
  const [settling, setSettling] = useState(false);

  const springBack = () => {
    setSettling(true);
    setOffset(0);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.stopPropagation();
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, committed: false, offset: 0 };
    setSettling(false);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
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
    if (Math.abs(dy) > driftLimit) {
      gesture.current = null;
      springBack();
      return;
    }
    const allowed = dx > 0 ? onRight !== null : onLeft !== null;
    const magnitude = Math.abs(dx);
    const eased = magnitude <= swipeThreshold ? magnitude : swipeThreshold + (magnitude - swipeThreshold) * 0.35;
    current.offset = allowed ? Math.sign(dx) * eased : 0;
    setOffset(current.offset);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (!current.committed) return;
    if (current.offset >= swipeThreshold && onRight) onRight();
    else if (current.offset <= -swipeThreshold && onLeft) onLeft();
    springBack();
  };

  const onPointerCancel = () => {
    gesture.current = null;
    springBack();
  };

  const onLostPointerCapture = () => {
    if (gesture.current?.committed) onPointerCancel();
  };

  const onClickCapture = (event: MouseEvent<HTMLDivElement>) => {
    if (offset !== 0 || settling) {
      event.stopPropagation();
      event.preventDefault();
    }
  };

  return (
    <div
      className="swipeable"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onClickCapture={onClickCapture}
    >
      {offset > 0 && (
        <div className={offset >= swipeThreshold ? "reveal right past" : "reveal right"} style={{ width: offset }}>
          today
        </div>
      )}
      {offset < 0 && (
        <div className={offset <= -swipeThreshold ? "reveal left past" : "reveal left"} style={{ width: -offset }}>
          delete
        </div>
      )}
      <div
        className={settling ? "swiped settling" : "swiped"}
        style={{ transform: `translateX(${offset}px)` }}
        onTransitionEnd={() => setSettling(false)}
      >
        {children}
      </div>
    </div>
  );
}
