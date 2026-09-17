import { useRef, useState } from "react";
import type { MouseEvent, PointerEvent, ReactNode } from "react";

const swipeFraction = 0.4;
const commitDistance = 12;

interface Gesture {
  pointerId: number;
  startX: number;
  startY: number;
  committed: boolean;
  offset: number;
}

export interface Swipe {
  word: string;
  onSwipe: () => void;
}

export function Swipeable({ right, left, children }: { right: Swipe | null; left: Swipe | null; children: ReactNode }) {
  const gesture = useRef<Gesture | null>(null);
  const element = useRef<HTMLDivElement>(null);
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
    const allowed = dx > 0 ? right !== null : left !== null;
    current.offset = allowed ? dx : 0;
    setOffset(current.offset);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (!current || current.pointerId !== event.pointerId) return;
    gesture.current = null;
    if (!current.committed) return;
    const enough = (element.current?.offsetWidth ?? 0) * swipeFraction;
    if (current.offset >= enough && right) right.onSwipe();
    else if (current.offset <= -enough && left) left.onSwipe();
    springBack();
  };

  const onPointerCancel = () => {
    gesture.current = null;
    springBack();
  };

  const onLostPointerCapture = (event: PointerEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && gesture.current?.committed) onPointerCancel();
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
      ref={element}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onLostPointerCapture}
      onClickCapture={onClickCapture}
    >
      {offset > 0 && right && <div className="reveal right">{right.word}</div>}
      {offset < 0 && left && <div className="reveal left">{left.word}</div>}
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
