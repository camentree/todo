import type { TaskStage } from "./stages.ts";
import type { TaskState } from "./states.ts";

export type EventSource = "app" | "system" | "mcp" | "agent";

export type Frequency = "daily" | "weekly" | "monthly";

export interface Task {
  id: number;
  list: string;
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
  resolvedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
  unseenCommentCount: number;
  lastCommentFromOthers: boolean;
  subtasks?: Task[];
}

export interface Comment {
  id: number;
  taskId: number;
  author: string;
  body: string;
  createdAt: string;
  seenAt: string | null;
}

export interface RecurringTask {
  id: number;
  list: string;
  title: string;
  note: string | null;
  tags: string[];
  who: string | null;
  frequency: Frequency;
  repeatEvery: number;
  weekdays: number[];
  dayOfMonth: number | null;
  dueTime: string | null;
  startsOn: string;
  paused: boolean;
  generatedThrough: string | null;
}

export interface Event {
  id: number;
  taskId: number | null;
  source: EventSource;
  summary: string;
  createdAt: string;
}

export type BreakUpField =
  | "none"
  | "list"
  | "stage"
  | "tag"
  | "due_date"
  | "who";

export type SortField =
  | "manual"
  | "due_date"
  | "title"
  | "created_at"
  | "resolved_at";

export type SortDirection = "asc" | "desc";

export type Density = "airy" | "compact";

export type Layout = "stacked" | "columns";

export interface ViewPreference {
  breakUpBy: BreakUpField;
  sortBy: SortField;
  sortDirection: SortDirection;
  density: Density;
  layout: Layout;
}

export interface TaskQuery {
  list?: string;
  stage?: TaskStage;
  states?: TaskState[];
  dueOnOrBefore?: string;
  includeArchived?: boolean;
  recurringTaskId?: number;
  search?: string;
  tags?: string[];
  who?: string;
  hasNoDueDate?: boolean;
  overdue?: boolean;
}
