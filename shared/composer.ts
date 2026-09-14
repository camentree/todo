import type { ParsedEntry, ParsedTask } from "./grammar.ts";
import { parseEntry } from "./grammar.ts";
import { autoRule } from "./tasks.ts";
import type { Definition, Task } from "./types.ts";
import { newId } from "./types.ts";

function taskFrom({ parsed, id, parent, group }: { parsed: ParsedTask; id: string; parent: string | null; group: string }): Task {
  return {
    id,
    name: parsed.title,
    type: parsed.type,
    kind: parsed.kind,
    target: parsed.target,
    current: parsed.current ?? 0,
    unit: parsed.unit,
    rest: parsed.rest,
    parent,
    group,
    note: parsed.note,
    value: parsed.value ?? "",
    doneManual: parsed.doneManual,
    tapIncrement: parsed.tapIncrement,
    definitionId: null,
    auto: parent ? null : autoRule({ name: parsed.title, kind: parsed.kind }),
  };
}

function definitionFrom({ parsed, id, anchor }: { parsed: ParsedEntry; id: string; anchor: string }): Definition {
  return {
    id,
    name: parsed.title,
    group: parsed.group,
    kind: parsed.kind,
    target: parsed.target,
    unit: parsed.unit,
    rest: parsed.rest,
    every: parsed.every ?? "1d",
    note: parsed.note,
    tapIncrement: parsed.tapIncrement,
    children: parsed.children.map((child) => ({ name: child.title, kind: child.kind, target: child.target, unit: child.unit, note: child.note })),
    anchor,
  };
}

export function commitEntry({
  text,
  tasks,
  definitions,
  editTaskId,
  editDefinitionId,
  date,
}: {
  text: string;
  tasks: Task[];
  definitions: Definition[];
  editTaskId: string | null;
  editDefinitionId: string | null;
  date: string;
}): { tasks: Task[]; definitions: Definition[]; rootId: string } | null {
  const parsed = parseEntry(text);
  if (!parsed) return null;
  const rootId = editTaskId ?? newId("t");
  const root = taskFrom({ parsed, id: rootId, parent: null, group: parsed.group });
  root.rest = parsed.rest;
  const old = editTaskId ? tasks.find((task) => task.id === editTaskId) : undefined;
  if (old) {
    root.definitionId = old.definitionId;
    if (parsed.current === null && parsed.value === null && parsed.doneManual === null) {
      root.current = old.current;
      root.doneManual = old.doneManual;
      root.value = old.value;
    }
  }
  const oldChildren = editTaskId ? tasks.filter((task) => task.parent === editTaskId) : [];
  const children = parsed.children.map((child, index) => {
    const previous = oldChildren[index];
    const task = taskFrom({ parsed: child, id: previous?.id ?? newId("t"), parent: rootId, group: parsed.group });
    task.rest = parsed.rest;
    if (previous && child.current === null && child.value === null && child.doneManual === null) {
      task.current = previous.current;
      task.doneManual = previous.doneManual;
      task.value = previous.value;
    }
    return task;
  });
  const block = [root, ...children];
  const at = editTaskId ? tasks.findIndex((task) => task.id === editTaskId) : -1;
  const remaining = editTaskId ? tasks.filter((task) => task.id !== editTaskId && task.parent !== editTaskId) : [...tasks];
  if (at >= 0) remaining.splice(Math.min(at, remaining.length), 0, ...block);
  else remaining.push(...block);
  let nextDefinitions = definitions;
  if (parsed.every) {
    const id = editDefinitionId ?? root.definitionId ?? newId("d");
    const existing = definitions.find((definition) => definition.id === id);
    const definition = definitionFrom({ parsed, id, anchor: existing?.anchor ?? date });
    root.definitionId = id;
    nextDefinitions = existing ? definitions.map((each) => (each.id === id ? definition : each)) : [...definitions, definition];
  }
  return { tasks: remaining, definitions: nextDefinitions, rootId };
}
