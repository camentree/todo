import type { Task } from "./model.ts";
import { subtaskDone } from "./tasks.ts";

export interface QueueItem {
  taskId: string;
  subtaskIndex: number | null;
}

export type Phase = "subtask" | "rest" | "taskEnd" | "end";

export interface RunnerState {
  queue: QueueItem[];
  index: number;
  phase: Phase;
  running: boolean;
  rest: number;
}

export function buildQueue(tasks: Task[]): QueueItem[] {
  return tasks.flatMap((task): QueueItem[] =>
    task.subtasks.length ? task.subtasks.map((_, subtaskIndex) => ({ taskId: task.id, subtaskIndex })) : [{ taskId: task.id, subtaskIndex: null }],
  );
}

export function stepOf({ item, tasks }: { item: QueueItem; tasks: Task[] }): { task: Task; subtask: Task } | null {
  const task = tasks.find((each) => each.id === item.taskId);
  if (!task) return null;
  const subtask = item.subtaskIndex === null ? task : task.subtasks[item.subtaskIndex];
  return subtask ? { task, subtask } : null;
}

export function startRunner({ tasks, from }: { tasks: Task[]; from: string }): RunnerState {
  const queue = buildQueue(tasks);
  const start = Math.max(0, queue.findIndex((item) => item.taskId === from));
  const firstOpen = queue.findIndex((item, index) => {
    const step = stepOf({ item, tasks });
    return index >= start && step ? !subtaskDone(step.subtask) : false;
  });
  if (firstOpen === -1) return { queue, index: queue.length ? start : 0, phase: queue.length ? "taskEnd" : "end", running: false, rest: 0 };
  return { queue, index: firstOpen, phase: "subtask", running: false, rest: 0 };
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
  const rest = task?.restSeconds ?? 0;
  if (rest > 0) return { ...state, phase: "rest", rest, running: true };
  return advance(state);
}

export function advance(state: RunnerState): RunnerState {
  const index = state.index + 1;
  if (index >= state.queue.length) return { ...state, index: state.queue.length - 1, phase: "end", running: false, rest: 0 };
  return { ...state, index, phase: "subtask", running: false, rest: 0 };
}

export function goBack(state: RunnerState): RunnerState {
  if (state.phase === "end" || state.phase === "rest" || state.phase === "taskEnd") return { ...state, phase: "subtask", running: false, rest: 0 };
  return { ...state, index: Math.max(0, state.index - 1), phase: "subtask", running: false, rest: 0 };
}

export function jumpTo({ state, index }: { state: RunnerState; index: number }): RunnerState {
  return { ...state, index, phase: "subtask", running: false, rest: 0 };
}
