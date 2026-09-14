import { formatDuration } from "./format.ts";
import type { Definition, DerivedTask, JournalEntry, Kind, Task } from "./types.ts";
import { newId, typeOfKind } from "./types.ts";

export function childrenOf({ tasks, id }: { tasks: Task[]; id: string }): Task[] {
  return tasks.filter((task) => task.parent === id);
}

export function leafDone({ task, entries, date }: { task: Task; entries: JournalEntry[]; date: string }): boolean {
  if (task.doneManual !== null) return task.doneManual;
  if (task.auto === "journal") return entries.some((entry) => entry.at.slice(0, 10) === date);
  if (task.type === "numeric") return task.target > 0 && task.current >= task.target;
  if (task.type === "text") return task.value !== "";
  return false;
}

export function derive({ tasks, entries, date }: { tasks: Task[]; entries: JournalEntry[]; date: string }): DerivedTask[] {
  const derived: DerivedTask[] = tasks.map((task) => ({ ...task, done: false }));
  for (const task of derived) {
    if (childrenOf({ tasks: derived, id: task.id }).length === 0) task.done = leafDone({ task, entries, date });
  }
  for (const task of derived) {
    const children = childrenOf({ tasks: derived, id: task.id }) as DerivedTask[];
    if (children.length === 0) continue;
    task.current = children.filter((child) => child.done).length;
    task.target = children.length;
    task.done = task.doneManual ?? task.current >= task.target;
  }
  return derived;
}

export function plain(tasks: DerivedTask[]): Task[] {
  return tasks.map(({ done, ...task }) => {
    void done;
    return task;
  });
}

export function toggled({ tasks: derived, task }: { tasks: DerivedTask[]; task: DerivedTask }): Task[] {
  const tasks = plain(derived);
  const children = childrenOf({ tasks, id: task.id });
  if (children.length) {
    const to = !task.done;
    return tasks.map((each) => {
      if (each.id === task.id) return { ...each, doneManual: null };
      if (each.parent !== task.id) return each;
      if (to) return { ...each, doneManual: true, current: each.type === "numeric" ? each.target : each.current };
      return { ...each, doneManual: each.type === "boolean" ? false : null, current: 0, value: "" };
    });
  }
  const patch: Partial<Task> = task.done
    ? task.type === "numeric"
      ? { doneManual: null, current: 0 }
      : task.type === "text"
        ? { doneManual: null, value: "" }
        : { doneManual: false }
    : task.type === "numeric"
      ? { doneManual: true, current: task.target > 0 ? task.target : task.current }
      : { doneManual: true };
  return tasks.map((each) => (each.id === task.id ? { ...each, ...patch } : each));
}

export function metaText(task: DerivedTask): string {
  if (task.type === "text") return task.value;
  if (task.type !== "numeric") return "";
  const partial = task.current > 0 && !task.done;
  if (task.kind === "timer") {
    return partial ? formatDuration(Math.round(task.current)) + " / " + formatDuration(task.target) : formatDuration(task.target);
  }
  if (task.kind === "count" && task.tapIncrement) return task.current ? String(task.current) : "";
  return (partial ? task.current + " / " : "") + task.target + (task.unit ? " " + task.unit : "");
}

export function valueText(task: DerivedTask): string {
  if (task.type === "text") return task.value;
  if (task.type !== "numeric") return "";
  if (task.kind === "timer") return formatDuration(Math.round(task.current));
  return task.current + (task.tapIncrement ? "" : " / " + task.target) + (task.unit ? " " + task.unit : "");
}

export function autoRule({ name, kind }: { name: string; kind: Kind }): "journal" | null {
  return name.toLowerCase() === "journal" && kind === "bool" ? "journal" : null;
}

export function instantiate({ definition, date }: { definition: Definition; date: string }): Task[] {
  const parentId = newId("t");
  const base = {
    current: 0,
    value: "",
    doneManual: null,
    auto: autoRule(definition),
  };
  const parent: Task = {
    ...base,
    id: parentId,
    name: definition.name,
    type: typeOfKind(definition.kind),
    kind: definition.kind,
    target: definition.children.length || definition.target,
    unit: definition.unit,
    rest: definition.rest,
    parent: null,
    group: definition.group,
    note: definition.note,
    tapIncrement: definition.tapIncrement,
    definitionId: definition.id,
  };
  const children: Task[] = definition.children.map((child) => ({
    ...base,
    auto: null,
    id: newId("t"),
    name: child.name,
    type: typeOfKind(child.kind),
    kind: child.kind,
    target: child.target,
    unit: child.unit,
    rest: definition.rest,
    parent: parentId,
    group: definition.group,
    note: child.note,
    tapIncrement: false,
    definitionId: null,
  }));
  void date;
  return [parent, ...children];
}
