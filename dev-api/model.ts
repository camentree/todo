export type TaskType = "boolean" | "timer_seconds" | "count" | "amount" | "text";

export type Frequency = "daily" | "weekly" | "monthly";

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

export type Rule = Pick<Schedule, "frequency" | "repeatEvery" | "weekdays" | "dayOfMonth" | "startsOn" | "endedOn">;

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween({ from, to }: { from: Date; to: Date }): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

export function shiftDate({ key, days }: { key: string; days: number }): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function isDue({ schedule, date }: { schedule: Rule; date: string }): boolean {
  const day = dateFromKey(date);
  const start = dateFromKey(schedule.startsOn);
  const elapsed = daysBetween({ from: start, to: day });
  if (elapsed < 0) return false;
  if (schedule.endedOn !== null && date >= schedule.endedOn) return false;
  if (schedule.frequency === "daily") return elapsed % schedule.repeatEvery === 0;
  if (schedule.frequency === "weekly") {
    const weekdays = schedule.weekdays?.length ? schedule.weekdays : [mondayIndex(start)];
    return weekdays.includes(mondayIndex(day)) && Math.floor(elapsed / 7) % schedule.repeatEvery === 0;
  }
  const dayOfMonth = schedule.dayOfMonth ?? start.getDate();
  const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
  return day.getDate() === dayOfMonth && months % schedule.repeatEvery === 0;
}
