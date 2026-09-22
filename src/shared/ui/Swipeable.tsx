import { useRef } from "react";
import type { ReactNode } from "react";

import { useSwipe } from "../hooks/useSwipe.ts";

export interface Swipe {
  word: string;
  onSwipe: () => void;
}

export function Swipeable({ right, left, children }: { right: Swipe | null; left: Swipe | null; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null);
  const { offset, settling, handlers, onSettled } = useSwipe({
    element,
    rightAllowed: right !== null,
    leftAllowed: left !== null,
    onRight: () => right?.onSwipe(),
    onLeft: () => left?.onSwipe(),
  });

  return (
    <div className="swipeable" ref={element} {...handlers}>
      {offset > 0 && right && <div className="reveal right">{right.word}</div>}
      {offset < 0 && left && <div className="reveal left">{left.word}</div>}
      <div className={settling ? "swiped settling" : "swiped"} style={{ transform: `translateX(${offset}px)` }} onTransitionEnd={onSettled}>
        {children}
      </div>
    </div>
  );
}
