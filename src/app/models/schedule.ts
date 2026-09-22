import { dateFromKey, dateKey } from "@shared/format.ts";

import type { TaskType } from "./task.ts";
import type { ParsedTask } from "./taskText.ts";

export type Frequency = "daily" | "weekly" | "monthly";

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

export type Rule = Pick<Schedule, "frequency" | "repeatEvery" | "weekdays" | "dayOfMonth" | "startsOn" | "endedOn">;

export interface EveryRule {
  frequency: Frequency;
  repeatEvery: number;
  weekdays: number[] | null;
  dayOfMonth: number | null;
}

const dayTokens = ["mo", "tu", "we", "th", "fr", "sa", "su"];
const interval = /^\d+[dwm]$/;

function daysBetween({ from, to }: { from: Date; to: Date }): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}

function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
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

export function nextDue({ schedule, after }: { schedule: Rule; after: string }): string | null {
  const start = dateFromKey(after);
  for (let offset = 1; offset <= 366; offset++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (isDue({ schedule, date: dateKey(candidate) })) return dateKey(candidate);
  }
  return null;
}

export function ruleFromToken(every: string): EveryRule {
  const pieces = every.split(" ");
  const found = pieces.map((piece) => /^(\d+)([dwm])$/.exec(piece)).find(Boolean);
  const weekdays = pieces
    .filter((piece) => !interval.test(piece))
    .flatMap((piece) => piece.split(","))
    .map((name) => dayTokens.indexOf(name))
    .filter((index) => index !== -1);
  if (weekdays.length) return { frequency: "weekly", repeatEvery: found?.[2] === "w" ? Number(found[1]) : 1, weekdays, dayOfMonth: null };
  if (!found) return { frequency: "daily", repeatEvery: 1, weekdays: null, dayOfMonth: null };
  const count = Number(found[1]);
  if (found[2] === "d") return { frequency: "daily", repeatEvery: count, weekdays: null, dayOfMonth: null };
  if (found[2] === "w") return { frequency: "weekly", repeatEvery: count, weekdays: null, dayOfMonth: null };
  return { frequency: "monthly", repeatEvery: count, weekdays: null, dayOfMonth: null };
}

export function everyToken(rule: EveryRule): string {
  if (rule.frequency === "daily") return rule.repeatEvery + "d";
  if (rule.frequency === "weekly") {
    const days = rule.weekdays?.length ? [...rule.weekdays].sort((a, b) => a - b).map((index) => dayTokens[index]).join(",") : "";
    if (!days) return rule.repeatEvery + "w";
    return rule.repeatEvery === 1 ? days : rule.repeatEvery + "w " + days;
  }
  return rule.repeatEvery + "m";
}

export function everyLabel(every: string | null): string {
  if (!every) return "";
  const singular: Record<string, string> = { d: "every day", w: "every week", m: "every month" };
  const plural: Record<string, string> = { d: "days", w: "weeks", m: "months" };
  return every
    .split(" ")
    .map((piece) => {
      const match = /^(\d+)([dwm])$/.exec(piece);
      if (match) return match[1] === "1" ? singular[match[2] ?? "d"] : "every " + match[1] + " " + plural[match[2] ?? "d"];
      return piece.split(",").join(", ");
    })
    .join(" ");
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
