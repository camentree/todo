import { useSyncExternalStore } from "react";

export interface Store<Held> {
  read: () => Held;
  write: (next: Held) => void;
  subscribe: (listener: () => void) => () => void;
}

export function createStore<Held>(initial: Held): Store<Held> {
  const listeners = new Set<() => void>();
  let held = initial;

  return {
    read: () => held,
    write: (next: Held) => {
      held = next;
      for (const listener of listeners) {
        listener();
      }
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export function useStore<Held>(store: Store<Held>): Held {
  return useSyncExternalStore(store.subscribe, store.read);
}
