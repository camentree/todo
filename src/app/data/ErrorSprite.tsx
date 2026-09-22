import { useStore } from "./store.tsx";

export function ErrorSprite() {
  const store = useStore();
  if (!store.error) return null;
  return (
    <div className="fixed bottom-[calc(var(--bottom)+9.4rem)] left-1/2 z-30 flex max-w-[22rem] -translate-x-1/2 flex-col items-center gap-2">
      <button className="rounded-card bg-warn px-4 py-[0.7rem] text-center text-body font-medium text-ground shadow-[0_8px_24px_var(--shadow)]" onClick={store.dismissError}>
        error
      </button>
      <div className="text-center text-meta leading-[1.4] text-dim">{store.error}</div>
    </div>
  );
}
