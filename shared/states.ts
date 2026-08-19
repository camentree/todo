export const TASK_STATES = [
  "to_do",
  "complete",
  "missed",
  "skipped",
  "hidden",
] as const;

export type TaskState = (typeof TASK_STATES)[number];

const TERMINAL_STATES: ReadonlySet<TaskState> = new Set([
  "complete",
  "missed",
  "skipped",
]);

export function isTerminal(state: TaskState): boolean {
  return TERMINAL_STATES.has(state);
}
