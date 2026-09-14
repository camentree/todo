export type Kind = "bool" | "timer" | "count" | "amount" | "weight" | "text";
export type TaskType = "boolean" | "numeric" | "text";
export const groupOrder = ["habits", "exercise", "personal"];
export const defaultNotebook = "daily";

export interface Task {
  id: string;
  name: string;
  type: TaskType;
  kind: Kind;
  target: number;
  current: number;
  unit: string;
  rest: number;
  parent: string | null;
  group: string;
  note: string;
  value: string;
  doneManual: boolean | null;
  tapIncrement: boolean;
  definitionId: string | null;
  auto: "journal" | null;
}

export interface DerivedTask extends Task {
  done: boolean;
}

export interface DefinitionChild {
  name: string;
  kind: Kind;
  target: number;
  unit: string;
  note: string;
}

export interface Definition {
  id: string;
  name: string;
  group: string;
  kind: Kind;
  target: number;
  unit: string;
  rest: number;
  every: string;
  note: string;
  tapIncrement: boolean;
  children: DefinitionChild[];
  anchor: string;
}

export interface JournalEntry {
  id: string;
  at: string;
  notebook: string;
  taskId: string | null;
  text: string;
}

export interface Comment {
  id: string;
  key: string;
  at: string;
  text: string;
}

export interface DayState {
  date: string;
  tasks: Task[];
  definitions: Definition[];
  entries: JournalEntry[];
  comments: Comment[];
}

export function typeOfKind(kind: Kind): TaskType {
  if (kind === "bool") return "boolean";
  if (kind === "text") return "text";
  return "numeric";
}

export function newId(prefix: string): string {
  return prefix + Math.random().toString(36).slice(2, 10);
}
