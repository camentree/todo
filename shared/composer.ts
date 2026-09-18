import { ruleFromToken } from "./grammar.ts";
import type { ParsedSubtask, ParsedTask } from "./grammar.ts";
import type { Schedule, Task } from "./model.ts";
import { isNumericType } from "./model.ts";
import { isDue } from "./schedule.ts";

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
  };
}

export function scheduleFromParsed({ parsed, existing, id, today, now }: { parsed: ParsedTask; existing: Schedule | null; id: string; today: string; now: string }): Schedule {
  const rule =
    parsed.every !== null
      ? ruleFromToken(parsed.every)
      : existing
        ? { frequency: existing.frequency, repeatEvery: existing.repeatEvery, weekdays: existing.weekdays, dayOfMonth: existing.dayOfMonth }
        : ruleFromToken("1d");
  return {
    id,
    title: parsed.title,
    group: parsed.group ?? existing?.group ?? "",
    type: parsed.type,
    target: parsed.target,
    restSeconds: parsed.restSeconds,
    subtasks: parsed.subtasks.map((subtask, index) => ({ title: subtask.title, type: subtask.type, target: subtask.target, restSeconds: null, note: subtask.note, sortOrder: index })),
    dueTime: parsed.time,
    ...rule,
    startsOn: existing?.startsOn ?? today,
    endedOn: null,
    note: parsed.note,
    sortOrder: existing?.sortOrder ?? 0,
    createdAt: existing?.createdAt ?? now,
  };
}

export function dueToday({ schedule, today }: { schedule: Schedule; today: string }): boolean {
  return isDue({ schedule, date: today });
}
