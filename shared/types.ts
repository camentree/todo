import type { TaskStage } from "./stages.ts";
import type { TaskState } from "./states.ts";

export type EventSource = "app" | "system" | "mcp" | "agent";

export type Frequency = "daily" | "weekly" | "monthly";

export interface Schedule {
  frequency: Frequency;
  repeatEvery: number;
  weekdays: number[];
  dayOfMonth: number | null;
  startsOn: string;
}

export interface Task {
  id: number | null;
  list: string | null;
  parentId: number | null;
  recurringTaskId: number | null;
  title: string;
  note: string | null;
  state: TaskState;
  stage: TaskStage | null;
  tags: string[];
  who: string | null;
  dueDate: string | null;
  dueTime: string | null;
  sortOrder: number;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  schedule: Schedule | null;
  subtasks?: CreatedTask[];
}

export interface CreatedTask extends Task {
  id: number;
  list: string;
}

export interface Comment {
  id: number;
  taskId: number;
  author: string;
  body: string;
  createdAt: string;
}

export interface RecurringTask extends Schedule {
  id: number;
  list: string;
  title: string;
  note: string | null;
  tags: string[];
  who: string | null;
  dueTime: string | null;
  endedAt: string | null;
  generatedThrough: string | null;
}

export interface Event {
  id: number;
  taskId: number | null;
  taskTitle: string | null;
  source: EventSource;
  summary: string;
  createdAt: string;
  seenAt: string | null;
}

export type GroupByField =
  | "none"
  | "list"
  | "stage"
  | "tag"
  | "due_date"
  | "who";

export type OrderByField =
  | "manual"
  | "relevance"
  | "due_date"
  | "title"
  | "tag"
  | "created_at"
  | "finished_at";

export type OrderDirection = "asc" | "desc";

export type Layout = "stacked" | "columns";

export interface ViewPreference {
  groupBy: GroupByField;
  orderBy: OrderByField;
  orderDirection: OrderDirection;
  layout: Layout;
}
