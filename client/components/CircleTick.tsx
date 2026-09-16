import type { PressHandlers } from "../interaction/longPress.ts";

export function CircleTick({ done, onToggle, press }: { done: boolean; onToggle: () => void; press: PressHandlers | null }) {
  return (
    <button className={done ? "tick done" : "tick"} aria-label={done ? "mark not done" : "mark done"} onClick={onToggle} {...press}>
      <span />
    </button>
  );
}
