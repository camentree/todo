import { dateFromKey, dateKey } from "./format.ts";
import type { Schedule } from "./model.ts";

export type Rule = Pick<Schedule, "frequency" | "repeatEvery" | "weekdays" | "dayOfMonth" | "startsOn" | "endedOn">;

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
