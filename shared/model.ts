export type TaskType = "boolean" | "timer_seconds" | "count" | "amount" | "text";

export type Frequency = "daily" | "weekly" | "monthly";

export const groupOrder = ["habits", "exercise", "personal"];

export function isNumericType(type: TaskType): boolean {
  return type === "timer_seconds" || type === "count" || type === "amount";
}

export interface SubtaskSpec {
  title: string;
  type: TaskType;
  target: number | null;
  restSeconds: number | null;
  note: string;
  sortOrder: number;
}

export interface Schedule {
  id: string;
  title: string;
  group: string;
  type: TaskType;
  target: number | null;
  restSeconds: number | null;
  subtasks: SubtaskSpec[];
  dueTime: string | null;
  frequency: Frequency;
  repeatEvery: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
  startsOn: string;
  endedOn: string | null;
  note: string;
  sortOrder: number;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Comment {
  id: string;
  taskId: string;
  body: string;
  author: string;
  writtenAt: string;
  seenAt: string | null;
  createdAt: string;
  deletedAt?: string | null;
}

export interface Task {
  id: string;
  parentId: string | null;
  scheduleId: string | null;
  dueDate: string | null;
  dueTime: string | null;
  title: string;
  group: string;
  type: TaskType;
  target: number | null;
  numericalValue: number | null;
  stringValue: string | null;
  restSeconds: number | null;
  finalizedAt: string | null;
  isSkipped: boolean;
  assignee: string | null;
  note: string;
  sortOrder: number;
  subtasks: Task[];
  comments: Comment[];
  createdAt: string;
  // Parallax leaves deletedAt off a live task entirely; only the recently deleted
  // list carries it, so read it as "deleted if truthy" rather than testing for null.
  deletedAt?: string | null;
}

export interface JournalMetadata {
  displayTitle?: string;
  tags?: string[];
  author?: string;
  deletedAt?: string;
}

export interface JournalEntry {
  sectionTitle: string;
  at: string;
  body: string;
  metadata: JournalMetadata;
}
