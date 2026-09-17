export function CircleTick({ done, skipped, onToggle }: { done: boolean; skipped: boolean; onToggle: () => void }) {
  return (
    <button className={done ? "tick done" : skipped ? "tick skipped" : "tick"} aria-label={done ? "mark not done" : "mark done"} onClick={onToggle}>
      <span />
    </button>
  );
}
