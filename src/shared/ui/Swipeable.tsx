import { useRef } from "react";
import type { ReactNode } from "react";

import { useSwipe } from "../hooks/useSwipe.ts";

export interface Swipe {
  word: string;
  onSwipe: () => void;
}

const reveal = "absolute inset-y-0 flex w-[40%] items-center rounded-xl px-[1.15rem] text-label font-semibold whitespace-nowrap text-ground will-change-transform";

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
    <div className="swipeable relative touch-pan-y overflow-hidden" ref={element} {...handlers}>
      {offset > 0 && right && <div className={reveal + " left-0 justify-start bg-[linear-gradient(to_right,var(--swipe-accent)_0_45%,transparent_100%)]"}>{right.word}</div>}
      {offset < 0 && left && <div className={reveal + " right-0 justify-end bg-[linear-gradient(to_left,var(--swipe-warn)_0_45%,transparent_100%)]"}>{left.word}</div>}
      <div className={"relative bg-ground " + (settling ? "transition-transform duration-[250ms] ease-[ease]" : "")} style={{ transform: `translateX(${offset}px)` }} onTransitionEnd={onSettled}>
        {children}
      </div>
    </div>
  );
}
