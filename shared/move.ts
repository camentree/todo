import type { Definition, Task, TaskPart } from "./model.ts";

export type Container = "today" | "backlog";

export interface TopTarget {
  kind: "top";
  container: Container;
  group: string;
  index: number;
}

export interface PartTarget {
  kind: "part";
  taskId: string;
  index: number;
}

export type Target = TopTarget | PartTarget;

export function placed({ rows, moving, target, today }: { rows: Task[]; moving: Task[]; target: TopTarget; today: string }): Task[] {
  const movingIds = new Set(moving.map((task) => task.id));
  const remaining = rows.filter((task) => !movingIds.has(task.id));
  const index = Math.max(0, Math.min(target.index, remaining.length));
  const arrivals = moving.map((task) => ({
    ...task,
    group: target.container === "today" ? target.group : task.group,
    date: target.container === "today" ? today : null,
  }));
  const ordered = [...remaining.slice(0, index), ...arrivals, ...remaining.slice(index)];
  return ordered.map((task, sort) => ({ ...task, sort }));
}

export function changedOnly({ before, after }: { before: Task[]; after: Task[] }): Task[] {
  return after.filter((task) => {
    const previous = before.find((each) => each.id === task.id);
    return !previous || previous.sort !== task.sort || previous.group !== task.group || previous.date !== task.date;
  });
}

export function regrouped({ moving, definitions, group }: { moving: Task[]; definitions: Definition[]; group: string }): Definition[] {
  const ids = new Set(moving.map((task) => task.definitionId).filter((id): id is string => id !== null));
  return definitions.filter((definition) => ids.has(definition.id) && definition.group !== group).map((definition) => ({ ...definition, group }));
}

export function taskAsParts(task: Task): TaskPart[] {
  if (task.parts.length) return task.parts;
  return [{ name: task.name, kind: task.kind, target: task.target, timer: task.timer, note: task.note, current: task.current, value: task.value, doneAt: task.doneAt }];
}

export function partAsTask({ part, host, id, created }: { part: TaskPart; host: Task; id: string; created: string }): Task {
  return {
    id,
    definitionId: null,
    date: host.date,
    time: null,
    name: part.name,
    group: host.group,
    kind: part.kind,
    target: part.target,
    timer: part.timer,
    rest: 0,
    current: part.current,
    value: part.value,
    doneAt: part.doneAt,
    skippedAt: null,
    note: part.note,
    parts: [],
    sort: host.sort,
    created,
  };
}

export function withPartsInserted({ host, parts, index }: { host: Task; parts: TaskPart[]; index: number }): Task {
  const at = Math.max(0, Math.min(index, host.parts.length));
  return { ...host, parts: [...host.parts.slice(0, at), ...parts, ...host.parts.slice(at)] };
}

export function withoutPart({ host, index }: { host: Task; index: number }): Task {
  return { ...host, parts: host.parts.filter((_, each) => each !== index) };
}
