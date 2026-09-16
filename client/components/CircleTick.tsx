export function CircleTick({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button className={done ? "tick done" : "tick"} aria-label={done ? "mark not done" : "mark done"} onClick={onToggle}>
      <span />
    </button>
  );
}
