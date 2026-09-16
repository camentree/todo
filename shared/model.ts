export type Kind = "boolean" | "timer" | "count" | "text";

export const groupOrder = ["habits", "exercise", "personal"];

export interface Part {
  name: string;
  kind: Kind;
  target: number;
  timer: number;
  note: string;
}

export interface Definition {
  id: string;
  name: string;
  group: string;
  kind: Kind;
  target: number;
  timer: number;
  rest: number;
  time: string | null;
  every: string;
  anchor: string;
  parts: Part[];
  note: string;
  sort: number;
  created: string;
  ended: string | null;
}

export interface TaskPart extends Part {
  current: number;
  value: string;
  doneAt: string | null;
}

export interface Task {
  id: string;
  definitionId: string | null;
  date: string | null;
  time: string | null;
  name: string;
  group: string;
  kind: Kind;
  target: number;
  timer: number;
  rest: number;
  current: number;
  value: string;
  doneAt: string | null;
  note: string;
  parts: TaskPart[];
  sort: number;
  created: string;
}

export interface Comment {
  id: string;
  definitionId: string | null;
  taskName: string;
  body: string;
  author: string;
  writtenAt: string;
  seenAt: string | null;
}

export interface JournalEntry {
  id: string;
  at: string;
  title: string;
  tags: string[];
  task: string | null;
  body: string;
}
