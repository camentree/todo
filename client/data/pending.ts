import { recordFailure } from "../data/failures.ts";
import { createStore, useStore } from "../data/store.ts";
import { record } from "../data/history.ts";
import type { Edit } from "../data/history.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

export const NO_DELAY = 0;
export const DEBOUNCED_MILLISECONDS = 500;
export const HOLD_MILLISECONDS = 2000;

interface Waiting {
  showing: CreatedTask;
  before: CreatedTask;
  timer: ReturnType<typeof setTimeout>;
}

const waiting = new Map<number, Waiting>();
const shown = createStore<ReadonlyMap<number, CreatedTask>>(
  new Map(),
);

let newest: number[] = [];

function announce(): void {
  shown.write(
    new Map(
      [...waiting].map(([taskId, entry]) => [taskId, entry.showing]),
    ),
  );
}

export function usePending(): ReadonlyMap<number, CreatedTask> {
  return useStore(shown);
}

export function pendingFor(taskId: number): CreatedTask | undefined {
  return waiting.get(taskId)?.showing;
}

export function withChanges(
  task: CreatedTask,
  changes: Partial<Task>,
): CreatedTask {
  return {
    ...task,
    ...changes,
    id: task.id,
    list: changes.list ?? task.list,
  };
}

export function inLayout(
  tasks: CreatedTask[],
  held: ReadonlyMap<number, CreatedTask>,
): CreatedTask[] {
  if (held.size === 0) {
    return tasks;
  }

  const placed: { task: CreatedTask; parentId: number | null }[] = [];

  function gather(
    list: CreatedTask[],
    parentId: number | null,
  ): void {
    for (const task of list) {
      const pending = held.get(task.id);
      const shown = pending
        ? {
            ...task,
            ...pending,
            state: task.state,
            finishedAt: task.finishedAt,
          }
        : task;
      placed.push({
        task: shown,
        parentId: pending ? shown.parentId : parentId,
      });
      gather(task.subtasks ?? [], task.id);
    }
  }

  gather(tasks, null);

  const children = new Map<number, CreatedTask[]>();
  for (const { task, parentId } of placed) {
    if (parentId === null) {
      continue;
    }
    children.set(parentId, [...(children.get(parentId) ?? []), task]);
  }

  return placed
    .filter(({ parentId }) => parentId === null)
    .map(({ task }) => ({
      ...task,
      parentId: null,
      subtasks: (children.get(task.id) ?? []).sort(
        (left, right) => left.sortOrder - right.sortOrder,
      ),
    }));
}

function forget(taskIds: number[]): void {
  for (const taskId of taskIds) {
    const entry = waiting.get(taskId);
    if (entry) {
      clearTimeout(entry.timer);
      waiting.delete(taskId);
    }
  }
  newest = newest.filter((taskId) => waiting.has(taskId));
  announce();
}

export function cancelNewest(): boolean {
  if (newest.length === 0) {
    return false;
  }
  forget(newest);
  return true;
}

export function defer({
  edited,
  call,
  delay,
  doing,
  coalescing = false,
}: {
  edited: { before: CreatedTask; showing: CreatedTask }[];
  call: () => Promise<CreatedTask[]>;
  delay: number;
  doing: string;
  coalescing?: boolean;
}): void {
  const covered = edited.map(({ before }) => before.id);
  const settled = edited.filter(
    ({ before, showing }) =>
      JSON.stringify(before) !== JSON.stringify(showing),
  );

  if (settled.length === 0) {
    forget(covered);
    return;
  }

  async function commit(): Promise<void> {
    const starting = covered
      .map((taskId) => waiting.get(taskId)?.before)
      .filter((task): task is CreatedTask => task !== undefined);
    try {
      const written = await call();
      forget(covered);
      const edits: Edit[] = starting.map((before) => ({
        before: before,
        after: written.find((task) => task.id === before.id) ?? null,
      }));
      record({ edits: edits, coalescing: coalescing });
    } catch (error) {
      forget(covered);
      recordFailure({ doing: doing, error: error });
    }
  }

  const timer = setTimeout(() => void commit(), delay);
  for (const { before, showing } of settled) {
    const running = waiting.get(before.id);
    if (running) {
      clearTimeout(running.timer);
    }
    waiting.set(before.id, {
      showing: showing,
      before: running?.before ?? before,
      timer: timer,
    });
  }
  newest = covered;
  announce();
}
