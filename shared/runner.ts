import { childrenOf } from "./tasks.ts";
import type { DerivedTask } from "./types.ts";

export type Scope = "task" | "group";
export type Phase = "task" | "rest" | "taskEnd" | "end";

export interface RunnerState {
  scope: Scope;
  label: string;
  queue: string[];
  index: number;
  phase: Phase;
  endTask: string | null;
  running: boolean;
  rest: number;
}

export function buildQueue({ tasks, ids }: { tasks: DerivedTask[]; ids: string[] }): string[] {
  const queue: string[] = [];
  for (const id of ids) {
    const children = childrenOf({ tasks, id });
    if (children.length) children.forEach((child) => queue.push(child.id));
    else queue.push(id);
  }
  return queue;
}

export function startRunner({
  tasks,
  tapped,
  scope,
  groupTops,
  label,
}: {
  tasks: DerivedTask[];
  tapped: DerivedTask;
  scope: Scope;
  groupTops: DerivedTask[];
  label: string;
}): RunnerState | null {
  const root = tapped.parent ? (tasks.find((task) => task.id === tapped.parent) ?? tapped) : tapped;
  const queue = scope === "group" ? buildQueue({ tasks, ids: groupTops.map((task) => task.id) }) : buildQueue({ tasks, ids: [root.id] });
  if (queue.length === 0) return null;
  const find = (id: string) => tasks.find((task) => task.id === id);
  let index = tapped.parent && scope === "task" ? queue.indexOf(tapped.id) : queue.findIndex((id) => !find(id)?.done);
  if (index < 0) index = 0;
  const state: RunnerState = { scope, label, queue, index, phase: "task", endTask: null, running: false, rest: 0 };
  const allDone = queue.every((id) => find(id)?.done);
  if (allDone && scope === "group") return { ...state, index: queue.length, phase: "end" };
  if (allDone && scope === "task" && queue.length > 1 && !tapped.parent) return { ...state, index: queue.length - 1, phase: "taskEnd", endTask: root.id };
  if (allDone) return { ...state, index: queue.length - 1 };
  return state;
}

export function currentTask({ state, tasks }: { state: RunnerState; tasks: DerivedTask[] }): DerivedTask | null {
  if (state.phase !== "task") return null;
  return tasks.find((task) => task.id === state.queue[state.index]) ?? null;
}

export function afterFinish({ state, tasks, finished }: { state: RunnerState; tasks: DerivedTask[]; finished: DerivedTask }): RunnerState {
  const nextId = state.queue[state.index + 1];
  const next = nextId ? tasks.find((task) => task.id === nextId) : undefined;
  const nextIsSibling = !!next && !!next.parent && next.parent === finished.parent;
  if (nextIsSibling && finished.rest > 0) return { ...state, phase: "rest", rest: finished.rest, running: true };
  if (finished.parent && !nextIsSibling) return { ...state, phase: "taskEnd", endTask: finished.parent, running: false };
  if (finished.parent) return advance({ state, tasks, fromRest: false, autoStartTimers: false }) ?? { ...state, running: false };
  return { ...state, running: false };
}

export function advance({
  state,
  tasks,
  fromRest,
  autoStartTimers,
}: {
  state: RunnerState;
  tasks: DerivedTask[];
  fromRest: boolean;
  autoStartTimers: boolean;
}): RunnerState | null {
  const index = state.index + 1;
  if (index >= state.queue.length) {
    if (state.scope !== "group") return null;
    return { ...state, index, phase: "end", running: false };
  }
  const next = tasks.find((task) => task.id === state.queue[index]);
  const running = autoStartTimers && fromRest && next?.kind === "timer";
  return { ...state, index, phase: "task", running, rest: 0 };
}

export function goBack(state: RunnerState): RunnerState {
  const index = Math.max(
    0,
    state.phase === "end" ? state.queue.length - 1 : state.phase === "rest" || state.phase === "taskEnd" ? state.index : state.index - 1,
  );
  return { ...state, index, phase: "task", running: false };
}

export function jumpTo({ state, index }: { state: RunnerState; index: number }): RunnerState {
  return { ...state, index, phase: "task", running: false, rest: 0 };
}

export function isLastScreen(state: RunnerState): boolean {
  if (state.scope === "group") return state.phase === "end";
  return state.phase === "taskEnd" || state.queue.length === 1;
}
