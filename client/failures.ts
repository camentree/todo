import { useSyncExternalStore } from "react";

const SHOWING_MILLISECONDS = 4000;

export interface Failure {
  id: number;
  doing: string;
  reason: string;
  at: string;
  showing: boolean;
}

const listeners = new Set<() => void>();

let failures: Failure[] = [];
let nextId = 1;

function announce(): void {
  failures = [...failures];
  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function recordFailure({
  doing,
  error,
}: {
  doing: string;
  error: unknown;
}): void {
  const id = nextId;
  nextId += 1;
  failures = [
    {
      id: id,
      doing: doing,
      reason:
        error instanceof Error ? error.message : "request failed",
      at: new Date().toISOString(),
      showing: true,
    },
    ...failures,
  ];
  announce();

  setTimeout(() => {
    failures = failures.map((failure) =>
      failure.id === id ? { ...failure, showing: false } : failure,
    );
    announce();
  }, SHOWING_MILLISECONDS);
}

export function dismissFailure(id: number): void {
  failures = failures.filter((failure) => failure.id !== id);
  announce();
}

export function useFailures(): Failure[] {
  return useSyncExternalStore(subscribe, () => failures);
}
