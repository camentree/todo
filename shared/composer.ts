import type { ParsedPart, ParsedTask } from "./grammar.ts";
import type { Definition, Part, Task, TaskPart } from "./model.ts";
import { isDue } from "./schedule.ts";

function progressOf({ parsed, previous, now }: { parsed: ParsedPart; previous: { current: number; value: string; doneAt: string | null } | undefined; now: string }): { current: number; value: string; doneAt: string | null } {
  if (parsed.current === null && parsed.value === null && parsed.done === null) {
    return previous ? { current: previous.current, value: previous.value, doneAt: previous.doneAt } : { current: 0, value: "", doneAt: null };
  }
  return {
    current: parsed.current ?? (parsed.done ? (parsed.kind === "count" ? parsed.target : parsed.kind === "timer" ? parsed.timer : 0) : 0),
    value: parsed.value ?? "",
    doneAt: parsed.done ? (previous?.doneAt ?? now) : null,
  };
}

function partsFrom({ parsed, previous, now }: { parsed: ParsedPart[]; previous: TaskPart[]; now: string }): TaskPart[] {
  const unused = [...previous];
  return parsed.map((part, index) => {
    let match = unused.findIndex((each) => each.name === part.name);
    if (match === -1 && unused[index] && previous.length === parsed.length && !parsed.some((each) => each.name === unused[index]?.name)) match = index;
    const before = match === -1 ? undefined : unused.splice(match, 1)[0];
    return { name: part.name, kind: part.kind, target: part.target, timer: part.timer, note: part.note, ...progressOf({ parsed: part, previous: before, now }) };
  });
}

export function taskFromParsed({ parsed, existing, id, today, now, definition }: { parsed: ParsedTask; existing: Task | null; id: string; today: string; now: string; definition: Definition | null }): Task {
  return {
    id,
    definitionId: definition?.id ?? null,
    date: definition ? (existing?.date ?? today) : parsed.date,
    time: parsed.time,
    name: parsed.name,
    group: parsed.group ?? existing?.group ?? "",
    kind: parsed.kind,
    target: parsed.target,
    timer: parsed.timer,
    rest: parsed.rest,
    ...progressOf({ parsed, previous: existing ?? undefined, now }),
    skippedAt: existing?.skippedAt ?? null,
    note: parsed.note,
    parts: partsFrom({ parsed: parsed.parts, previous: existing?.parts ?? [], now }),
    sort: existing?.sort ?? 0,
    created: existing?.created ?? now,
  };
}

export function definitionFromParsed({ parsed, existing, id, today }: { parsed: ParsedTask; existing: Definition | null; id: string; today: string }): Definition {
  const parts: Part[] = parsed.parts.map((part) => ({ name: part.name, kind: part.kind, target: part.target, timer: part.timer, note: part.note }));
  return {
    id,
    name: parsed.name,
    group: parsed.group ?? existing?.group ?? "",
    kind: parsed.kind,
    target: parsed.target,
    timer: parsed.timer,
    rest: parsed.rest,
    time: parsed.time,
    every: parsed.every ?? existing?.every ?? "1d",
    anchor: existing?.anchor ?? today,
    parts,
    note: parsed.note,
    sort: existing?.sort ?? 0,
    created: existing?.created ?? today,
    ended: null,
  };
}

export function dueToday({ definition, today }: { definition: Definition; today: string }): boolean {
  return isDue({ every: definition.every, anchor: definition.anchor, date: today });
}
