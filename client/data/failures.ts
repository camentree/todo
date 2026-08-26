import { createStore, useStore } from "../data/store.ts";

const SHOWING_MILLISECONDS = 4000;

export interface Failure {
  id: number;
  doing: string;
  reason: string;
  at: string;
  showing: boolean;
}

const showing = createStore<Failure[]>([]);
let nextId = 1;

export function recordFailure({
  doing,
  error,
}: {
  doing: string;
  error: unknown;
}): void {
  const id = nextId;
  nextId += 1;
  showing.write([
    {
      id: id,
      doing: doing,
      reason:
        error instanceof Error ? error.message : "request failed",
      at: new Date().toISOString(),
      showing: true,
    },
    ...showing.read(),
  ]);

  setTimeout(() => {
    showing.write(
      showing
        .read()
        .map((failure) =>
          failure.id === id ? { ...failure, showing: false } : failure,
        ),
    );
  }, SHOWING_MILLISECONDS);
}

export function dismissFailure(id: number): void {
  showing.write(
    showing.read().filter((failure) => failure.id !== id),
  );
}

export function useFailures(): Failure[] {
  return useStore(showing);
}
