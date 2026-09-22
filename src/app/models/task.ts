import { daysBetween, formatDuration, relativeDate, timeOfDay } from "@shared/format.ts";

import type { Comment } from "./comment.ts";
import { unseenFor } from "./comment.ts";
import type { JournalEntry } from "./journal.ts";
import type { Schedule } from "./schedule.ts";
import type { ParsedSubtask, ParsedTask } from "./taskText.ts";

export type TaskType = "boolean" | "timer_seconds" | "count" | "amount" | "text";

export const groupOrder = ["habits", "exercise", "personal"];

export function isNumericType(type: TaskType): boolean {
  return type === "timer_seconds" || type === "count" || type === "amount";
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

export function subtaskDone(task: Task): boolean {
  if (task.isSkipped) return false;
  if (task.finalizedAt) return true;
  if (isNumericType(task.type)) return (task.target ?? 0) > 0 && (task.numericalValue ?? 0) >= (task.target ?? 0);
  if (task.type === "text") return (task.stringValue ?? "") !== "";
  return false;
}

export function isDone({ task, entries }: { task: Task; entries: JournalEntry[] }): boolean {
  if (task.isSkipped) return false;
  if (task.finalizedAt) return true;
  if (task.subtasks.length) return task.subtasks.every(subtaskDone);
  if (task.type === "boolean" && task.title.toLowerCase() === "journal" && task.dueDate) {
    const dueDate = task.dueDate;
    return entries.some((entry) => entry.at.slice(0, 10) === dueDate);
  }
  return subtaskDone(task);
}

export function isSkipped(task: Task): boolean {
  return task.isSkipped;
}

export function skipToggled(task: Task): Task {
  return { ...task, isSkipped: !task.isSkipped };
}

function finishedSubtask({ subtask, now }: { subtask: Task; now: string }): Task {
  return { ...subtask, finalizedAt: now, numericalValue: isNumericType(subtask.type) ? subtask.target : subtask.numericalValue };
}

function clearedSubtask(subtask: Task): Task {
  return {
    ...subtask,
    finalizedAt: null,
    numericalValue: isNumericType(subtask.type) ? 0 : null,
    stringValue: subtask.type === "text" ? "" : null,
  };
}

export function toggled({ task, entries, now }: { task: Task; entries: JournalEntry[]; now: string }): Task {
  if (isDone({ task, entries })) {
    return {
      ...task,
      finalizedAt: null,
      numericalValue: isNumericType(task.type) ? 0 : null,
      stringValue: task.type === "text" ? "" : null,
      subtasks: task.subtasks.map(clearedSubtask),
    };
  }
  return {
    ...task,
    finalizedAt: now,
    isSkipped: false,
    numericalValue: isNumericType(task.type) ? task.target : task.numericalValue,
    subtasks: task.subtasks.map((subtask) => finishedSubtask({ subtask, now })),
  };
}

export function subtaskToggled({ task, index, now }: { task: Task; index: number; now: string }): Task {
  const subtasks = task.subtasks.map((subtask, each) => {
    if (each !== index) return subtask;
    if (subtaskDone(subtask)) return clearedSubtask(subtask);
    return finishedSubtask({ subtask, now });
  });
  return { ...task, subtasks, finalizedAt: subtasks.every(subtaskDone) ? (task.finalizedAt ?? now) : null };
}

export function orderedGroups(names: Iterable<string>): string[] {
  const all = [...new Set(names)];
  const others = all.filter((name) => name !== "" && !groupOrder.includes(name)).sort();
  return [...groupOrder.filter((name) => all.includes(name)), ...others, ...(all.includes("") ? [""] : [])];
}

export function groupLabel(group: string): string {
  return group === "" ? "ungrouped" : group;
}

export function byPosition(a: Task, b: Task): number {
  return a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

export function grouped(tasks: Task[]): { group: string; tasks: Task[] }[] {
  return orderedGroups(tasks.map((task) => task.group)).map((group) => ({ group, tasks: tasks.filter((task) => task.group === group).sort(byPosition) }));
}

export function isOnToday({ task, today, entries }: { task: Task; today: string; entries: JournalEntry[] }): boolean {
  if (task.dueDate === today) return true;
  if (task.dueDate && task.dueDate < today) return task.scheduleId === null && !isDone({ task, entries });
  if (task.dueDate === null) return unseenFor(task) && !isDone({ task, entries });
  return false;
}

export const recentDays = 1;
export const deletedDays = 5;

export function isRecentlyCompleted({ task, today, entries }: { task: Task; today: string; entries: JournalEntry[] }): boolean {
  if (!isDone({ task, entries })) return false;
  const finished = (task.finalizedAt ?? "").slice(0, 10);
  if (finished === "") return false;
  const since = daysBetween({ from: finished, to: today });
  return since >= 0 && since < recentDays;
}

export function isBacklog({ task, today, entries }: { task: Task; today: string; entries: JournalEntry[] }): boolean {
  if (isOnToday({ task, today, entries })) return false;
  if (task.dueDate !== null) return task.dueDate > today;
  if (!isDone({ task, entries })) return true;
  return isRecentlyCompleted({ task, today, entries });
}

export function kindHint(task: Pick<Task, "type" | "target" | "numericalValue" | "stringValue">): string {
  const target = task.target ?? 0;
  const progress = task.numericalValue ?? 0;
  if (task.type === "timer_seconds") return formatDuration(target);
  if (task.type === "count" || task.type === "amount") return progress > 0 && progress < target ? progress + " / " + target : String(target);
  if (task.type === "text") return task.stringValue ?? "";
  return "";
}

export function subtaskCount(task: Task): string {
  const remaining = task.subtasks.filter((subtask) => !subtaskDone(subtask)).length;
  if (remaining === 0) return "";
  return String(remaining);
}

export function whenHint({ task, today }: { task: Task; today: string }): string {
  const time = task.dueTime ? timeOfDay(task.dueTime) : "";
  if (task.dueDate === null || task.dueDate === today) return time;
  const day = relativeDate({ key: task.dueDate, today });
  return time ? day + ", " + time : day;
}

export type Container = "today" | "backlog";

export interface TopTarget {
  kind: "top";
  container: Container;
  group: string;
  index: number;
}

export interface SubtaskTarget {
  kind: "subtask";
  taskId: string;
  index: number;
}

export type Target = TopTarget | SubtaskTarget;

export function placed({ rows, moving, target, today }: { rows: Task[]; moving: Task[]; target: TopTarget; today: string }): Task[] {
  const movingIds = new Set(moving.map((task) => task.id));
  const remaining = rows.filter((task) => !movingIds.has(task.id));
  const index = Math.max(0, Math.min(target.index, remaining.length));
  const arrivals = moving.map((task) => ({
    ...task,
    group: target.container === "today" ? target.group : task.group,
    dueDate: target.container === "today" ? today : null,
  }));
  const ordered = [...remaining.slice(0, index), ...arrivals, ...remaining.slice(index)];
  return ordered.map((task, sortOrder) => ({ ...task, sortOrder }));
}

export function changedOnly({ before, after }: { before: Task[]; after: Task[] }): Task[] {
  return after.filter((task) => {
    const previous = before.find((each) => each.id === task.id);
    return !previous || previous.sortOrder !== task.sortOrder || previous.group !== task.group || previous.dueDate !== task.dueDate;
  });
}

export function regrouped({ moving, schedules, group }: { moving: Task[]; schedules: Schedule[]; group: string }): Schedule[] {
  const ids = new Set(moving.map((task) => task.scheduleId).filter((id): id is string => id !== null));
  return schedules.filter((schedule) => ids.has(schedule.id) && schedule.group !== group).map((schedule) => ({ ...schedule, group }));
}

export function taskAsSubtasks(task: Task): Task[] {
  if (task.subtasks.length) return task.subtasks;
  return [task];
}

export function subtaskAsTask({ subtask, host }: { subtask: Task; host: Task }): Task {
  return {
    ...subtask,
    parentId: null,
    scheduleId: null,
    dueDate: host.dueDate,
    dueTime: null,
    group: host.group,
    sortOrder: host.sortOrder,
    subtasks: [],
  };
}

export function withSubtasksInserted({ host, subtasks, index }: { host: Task; subtasks: Task[]; index: number }): Task {
  const at = Math.max(0, Math.min(index, host.subtasks.length));
  const arrivals = subtasks.map((subtask) => ({ ...subtask, parentId: host.id, scheduleId: null, dueDate: null, dueTime: null, group: host.group, subtasks: [] }));
  const ordered = [...host.subtasks.slice(0, at), ...arrivals, ...host.subtasks.slice(at)];
  return { ...host, subtasks: ordered.map((subtask, sortOrder) => ({ ...subtask, sortOrder })) };
}

export function withoutSubtask({ host, index }: { host: Task; index: number }): Task {
  return { ...host, subtasks: host.subtasks.filter((_, each) => each !== index).map((subtask, sortOrder) => ({ ...subtask, sortOrder })) };
}

function progressOf({ parsed, previous, now }: { parsed: ParsedSubtask; previous: Task | undefined; now: string }): { numericalValue: number | null; stringValue: string | null; finalizedAt: string | null } {
  const numeric = isNumericType(parsed.type);
  if (parsed.current === null && parsed.value === null && parsed.done === null) {
    return {
      numericalValue: numeric ? (previous?.numericalValue ?? 0) : null,
      stringValue: parsed.type === "text" ? (previous?.stringValue ?? "") : null,
      finalizedAt: previous?.finalizedAt ?? null,
    };
  }
  return {
    numericalValue: numeric ? (parsed.current ?? (parsed.done ? parsed.target : 0)) : null,
    stringValue: parsed.type === "text" ? (parsed.value ?? "") : null,
    finalizedAt: parsed.done ? (previous?.finalizedAt ?? now) : null,
  };
}

function subtasksFrom({ parsed, previous, hostId, group, now, newId }: { parsed: ParsedSubtask[]; previous: Task[]; hostId: string; group: string; now: string; newId: () => string }): Task[] {
  const unused = [...previous];
  return parsed.map((subtask, index) => {
    let match = unused.findIndex((each) => each.title === subtask.title);
    if (match === -1 && unused[index] && previous.length === parsed.length && !parsed.some((each) => each.title === unused[index]?.title)) match = index;
    const before = match === -1 ? undefined : unused.splice(match, 1)[0];
    const progress = progressOf({ parsed: subtask, previous: before, now });
    return {
      id: before?.id ?? newId(),
      parentId: hostId,
      scheduleId: null,
      dueDate: null,
      dueTime: null,
      title: subtask.title,
      group,
      type: subtask.type,
      target: subtask.target,
      numericalValue: progress.numericalValue,
      stringValue: progress.stringValue,
      restSeconds: before?.restSeconds ?? null,
      finalizedAt: progress.finalizedAt,
      isSkipped: false,
      assignee: before?.assignee ?? null,
      note: subtask.note,
      sortOrder: index,
      subtasks: [],
      comments: before?.comments ?? [],
      createdAt: before?.createdAt ?? now,
      deletedAt: null,
    };
  });
}

export function taskFromParsed({ parsed, existing, id, today, now, schedule, newId }: { parsed: ParsedTask; existing: Task | null; id: string; today: string; now: string; schedule: Schedule | null; newId: () => string }): Task {
  const group = parsed.group ?? existing?.group ?? "";
  const progress = progressOf({ parsed, previous: existing ?? undefined, now });
  return {
    id,
    parentId: existing?.parentId ?? null,
    scheduleId: schedule?.id ?? null,
    dueDate: schedule ? (existing?.dueDate ?? today) : parsed.date,
    dueTime: parsed.time,
    title: parsed.title,
    group,
    type: parsed.type,
    target: parsed.target,
    numericalValue: progress.numericalValue,
    stringValue: progress.stringValue,
    restSeconds: parsed.restSeconds,
    finalizedAt: progress.finalizedAt,
    isSkipped: existing?.isSkipped ?? false,
    assignee: existing?.assignee ?? null,
    note: parsed.note,
    sortOrder: existing?.sortOrder ?? 0,
    subtasks: subtasksFrom({ parsed: parsed.subtasks, previous: existing?.subtasks ?? [], hostId: id, group, now, newId }),
    comments: existing?.comments ?? [],
    createdAt: existing?.createdAt ?? now,
    deletedAt: null,
  };
}
