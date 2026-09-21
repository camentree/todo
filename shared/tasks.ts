import { daysBetween, formatDuration, relativeDate, timeOfDay } from "./format.ts";
import type { Comment, JournalEntry, Task } from "./model.ts";
import { groupOrder, isNumericType } from "./model.ts";

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

export function commentsFor(task: Task): Comment[] {
  return [...task.comments].sort((a, b) => b.writtenAt.localeCompare(a.writtenAt));
}

export function unseenFor(task: Task): boolean {
  return task.comments.some((comment) => comment.seenAt === null);
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
