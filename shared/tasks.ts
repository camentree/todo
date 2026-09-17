import { formatDuration, relativeDate, timeOfDay } from "./format.ts";
import type { Comment, JournalEntry, Task, TaskPart } from "./model.ts";
import { groupOrder } from "./model.ts";

export function partDone(part: TaskPart): boolean {
  if (part.doneAt) return true;
  if (part.kind === "count") return part.target > 0 && part.current >= part.target;
  if (part.kind === "timer") return part.timer > 0 && part.current >= part.timer;
  if (part.kind === "text") return part.value !== "";
  return false;
}

export function isDone({ task, entries }: { task: Task; entries: JournalEntry[] }): boolean {
  if (task.doneAt) return true;
  if (task.parts.length) return task.parts.every(partDone);
  if (task.kind === "boolean" && task.name.toLowerCase() === "journal" && task.date) {
    const date = task.date;
    return entries.some((entry) => entry.at.slice(0, 10) === date);
  }
  return partDone(task);
}

export function isSkipped(task: Task): boolean {
  return task.skippedAt !== null;
}

export function skipToggled({ task, now }: { task: Task; now: string }): Task {
  return { ...task, skippedAt: isSkipped(task) ? null : now };
}

export function toggled({ task, entries, now }: { task: Task; entries: JournalEntry[]; now: string }): Task {
  if (isDone({ task, entries })) {
    return {
      ...task,
      doneAt: null,
      current: task.kind === "count" || task.kind === "timer" ? 0 : task.current,
      value: task.kind === "text" ? "" : task.value,
      parts: task.parts.map((part) => ({ ...part, doneAt: null, current: 0, value: "" })),
    };
  }
  return {
    ...task,
    doneAt: now,
    skippedAt: null,
    current: task.kind === "count" ? task.target : task.kind === "timer" ? task.timer : task.current,
    parts: task.parts.map((part) => ({ ...part, doneAt: now, current: part.kind === "count" ? part.target : part.kind === "timer" ? part.timer : part.current })),
  };
}

export function partToggled({ task, index, now }: { task: Task; index: number; now: string }): Task {
  const parts = task.parts.map((part, each) => {
    if (each !== index) return part;
    if (partDone(part)) return { ...part, doneAt: null, current: 0, value: "" };
    return { ...part, doneAt: now, current: part.kind === "count" ? part.target : part.kind === "timer" ? part.timer : part.current };
  });
  return { ...task, parts, doneAt: parts.every(partDone) ? (task.doneAt ?? now) : null };
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
  return a.sort - b.sort || a.created.localeCompare(b.created) || a.id.localeCompare(b.id);
}

export function grouped(tasks: Task[]): { group: string; tasks: Task[] }[] {
  return orderedGroups(tasks.map((task) => task.group)).map((group) => ({ group, tasks: tasks.filter((task) => task.group === group).sort(byPosition) }));
}

export function unseenFor({ task, comments }: { task: Task; comments: Comment[] }): boolean {
  return commentsFor({ task, comments }).some((comment) => comment.seenAt === null);
}

export function commentsFor({ task, comments }: { task: Task; comments: Comment[] }): Comment[] {
  return comments
    .filter((comment) => (task.definitionId ? comment.definitionId === task.definitionId : comment.definitionId === null && comment.taskName === task.name))
    .sort((a, b) => b.writtenAt.localeCompare(a.writtenAt));
}

export function isOnToday({ task, today, entries, comments }: { task: Task; today: string; entries: JournalEntry[]; comments: Comment[] }): boolean {
  if (task.date === today) return true;
  if (task.date && task.date < today) return task.definitionId === null && !isDone({ task, entries });
  if (task.date === null) return unseenFor({ task, comments }) && !isDone({ task, entries });
  return false;
}

export function isBacklog({ task, today, entries, comments }: { task: Task; today: string; entries: JournalEntry[]; comments: Comment[] }): boolean {
  if (isOnToday({ task, today, entries, comments })) return false;
  if (task.date !== null) return task.date > today;
  if (!isDone({ task, entries })) return true;
  return (task.doneAt ?? "").slice(0, 10) === today;
}

export function kindHint(task: Pick<Task, "kind" | "timer" | "target" | "current" | "value">): string {
  if (task.kind === "timer") return formatDuration(task.timer);
  if (task.kind === "count") return task.current > 0 && task.current < task.target ? task.current + " / " + task.target : String(task.target);
  if (task.kind === "text") return task.value;
  return "";
}

export function partCount(task: Task): string {
  const remaining = task.parts.filter((part) => !partDone(part)).length;
  if (remaining === 0) return "";
  return String(remaining);
}

export function whenHint({ task, today }: { task: Task; today: string }): string {
  const time = task.time ? timeOfDay(task.time) : "";
  if (task.date === null || task.date === today) return time;
  const day = relativeDate({ key: task.date, today });
  return time ? day + ", " + time : day;
}
