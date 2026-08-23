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

export const SEARCHABLE_STATES = [
  ...TASK_STATES,
  "archived",
] as const;

export type SearchableState = (typeof SEARCHABLE_STATES)[number];

export function asSearchableState(
  value: unknown,
): SearchableState | null {
  return SEARCHABLE_STATES.find((state) => state === value) ?? null;
}
