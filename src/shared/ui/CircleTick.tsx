const ring = "block size-tick rounded-full border-[1.5px] group-hover:border-dim";

export function CircleTick({ done, skipped, onToggle }: { done: boolean; skipped: boolean; onToggle: () => void }) {
  return (
    <button className="tick group m-[calc((var(--touch)-var(--tick))/-2)] flex size-touch flex-none items-center justify-center" aria-label={done ? "mark not done" : "mark done"} onClick={onToggle}>
      {done ? (
        <span className={ring + " border-dim bg-dim"} />
      ) : skipped ? (
        <span className={ring + " border-dim bg-[radial-gradient(circle,var(--dim)_0_28%,transparent_30%)]"} />
      ) : (
        <span className={ring + " border-faint"} />
      )}
    </button>
  );
}
