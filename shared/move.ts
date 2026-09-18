import type { Schedule, Task } from "./model.ts";

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
