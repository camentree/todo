import type { Task, TaskPart } from "./model.ts";
import { partDone } from "./tasks.ts";

export interface QueueItem {
  taskId: string;
  partIndex: number | null;
}

export type Phase = "part" | "rest" | "taskEnd" | "end";

export interface RunnerState {
  label: string;
  queue: QueueItem[];
  index: number;
  phase: Phase;
  running: boolean;
  rest: number;
}

export function buildQueue(tasks: Task[]): QueueItem[] {
  return tasks.flatMap((task): QueueItem[] =>
    task.parts.length ? task.parts.map((_, partIndex) => ({ taskId: task.id, partIndex })) : [{ taskId: task.id, partIndex: null }],
  );
}

export function stepOf({ item, tasks }: { item: QueueItem; tasks: Task[] }): { task: Task; part: TaskPart | Task } | null {
  const task = tasks.find((each) => each.id === item.taskId);
  if (!task) return null;
  const part = item.partIndex === null ? task : task.parts[item.partIndex];
  return part ? { task, part } : null;
}

export function startRunner({ tasks, label }: { tasks: Task[]; label: string }): RunnerState {
  const queue = buildQueue(tasks);
  const firstOpen = queue.findIndex((item) => {
    const step = stepOf({ item, tasks });
    return step ? !partDone(step.part) : false;
  });
  if (firstOpen === -1) return { label, queue, index: Math.max(0, queue.length - 1), phase: queue.length ? "taskEnd" : "end", running: false, rest: 0 };
  return { label, queue, index: firstOpen, phase: "part", running: false, rest: 0 };
}

export function currentItem(state: RunnerState): QueueItem | null {
  return state.phase === "end" ? null : (state.queue[state.index] ?? null);
}

export function afterFinish({ state, tasks }: { state: RunnerState; tasks: Task[] }): RunnerState {
  const item = state.queue[state.index];
  const next = state.queue[state.index + 1];
  if (!item) return { ...state, phase: "end", running: false };
  if (!next || next.taskId !== item.taskId) return { ...state, phase: "taskEnd", running: false, rest: 0 };
  const task = tasks.find((each) => each.id === item.taskId);
  if (task && task.rest > 0) return { ...state, phase: "rest", rest: task.rest, running: true };
  return advance(state);
}

export function advance(state: RunnerState): RunnerState {
  const index = state.index + 1;
  if (index >= state.queue.length) return { ...state, index: state.queue.length - 1, phase: "end", running: false, rest: 0 };
  return { ...state, index, phase: "part", running: false, rest: 0 };
}

export function goBack(state: RunnerState): RunnerState {
  if (state.phase === "end" || state.phase === "rest" || state.phase === "taskEnd") return { ...state, phase: "part", running: false, rest: 0 };
  return { ...state, index: Math.max(0, state.index - 1), phase: "part", running: false, rest: 0 };
}

export function jumpTo({ state, index }: { state: RunnerState; index: number }): RunnerState {
  return { ...state, index, phase: "part", running: false, rest: 0 };
}
