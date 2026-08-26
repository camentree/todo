export const TASK_STATES = [
  "to_do",
  "complete",
  "missed",
  "skipped",
  "hidden",
  "archived",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TERMINAL_STATES: ReadonlySet<TaskState> = new Set([
  "complete",
  "missed",
  "skipped",
  "archived",
]);

export function isTerminal(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}

export function asTaskState(value: unknown): TaskState | null {
  return TASK_STATES.find((state) => state === value) ?? null;
}
