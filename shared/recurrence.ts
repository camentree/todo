import {
  addDays,
  differenceInCalendarDays,
  differenceInCalendarMonths,
  format,
  getDate,
  getDay,
  getDaysInMonth,
  isAfter,
  isBefore,
  parseISO,
  startOfWeek,
} from "date-fns";

export type { Schedule } from "./types.ts";
import type { Schedule } from "./types.ts";

export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function dueDatesBetween({
  schedule,
  from,
  through,
}: {
  schedule: Schedule;
  from: string;
  through: string;
}): string[] {
  const start = parseISO(schedule.startsOn);
  const windowStart = parseISO(from);
  const windowEnd = parseISO(through);

  if (
    isBefore(windowEnd, start) ||
    isBefore(windowEnd, windowStart)
  ) {
    return [];
  }

  const dates: string[] = [];
  let candidate = isBefore(windowStart, start) ? start : windowStart;

  while (!isAfter(candidate, windowEnd)) {
    if (
      occursOn({ schedule: schedule, start: start, date: candidate })
    ) {
      dates.push(toDateString(candidate));
    }
    candidate = addDays(candidate, 1);
  }

  return dates;
}

function occursOn({
  schedule,
  start,
  date,
}: {
  schedule: Schedule;
  start: Date;
  date: Date;
}): boolean {
  if (isBefore(date, start)) {
    return false;
  }

  if (schedule.frequency === "daily") {
    const elapsed = differenceInCalendarDays(date, start);
    return elapsed % schedule.repeatEvery === 0;
  }

  if (schedule.frequency === "weekly") {
    const weekdays = schedule.weekdays.length
      ? schedule.weekdays
      : [getDay(start)];
    if (!weekdays.includes(getDay(date))) {
      return false;
    }
    const weeksElapsed = Math.round(
      differenceInCalendarDays(
        startOfWeek(date, { weekStartsOn: 1 }),
        startOfWeek(start, { weekStartsOn: 1 }),
      ) / 7,
    );
    return weeksElapsed % schedule.repeatEvery === 0;
  }

  const targetDay = schedule.dayOfMonth ?? getDate(start);
  const lastDayOfThisMonth = getDaysInMonth(date);
  const effectiveDay = Math.min(targetDay, lastDayOfThisMonth);
  if (getDate(date) !== effectiveDay) {
    return false;
  }
  const monthsElapsed = differenceInCalendarMonths(date, start);
  return (
    monthsElapsed >= 0 && monthsElapsed % schedule.repeatEvery === 0
  );
}

export function describeSchedule(schedule: Schedule): string {
  const every = schedule.repeatEvery;

  if (schedule.frequency === "daily") {
    return every === 1 ? "daily" : `every ${every} days`;
  }

  if (schedule.frequency === "weekly") {
    const names = schedule.weekdays
      .slice()
      .sort()
      .map((weekday) => WEEKDAY_NAMES[weekday])
      .filter((name): name is string => name !== undefined);
    const days = names.length ? names.join(", ") : "week";
    return every === 1
      ? `every ${days}`
      : `every ${every} weeks on ${days}`;
  }

  const day =
    schedule.dayOfMonth ?? getDate(parseISO(schedule.startsOn));
  return every === 1
    ? `monthly on the ${ordinal(day)}`
    : `every ${every} months on the ${ordinal(day)}`;
}

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function ordinal(day: number): string {
  const remainderOfTen = day % 10;
  const remainderOfHundred = day % 100;
  if (remainderOfTen === 1 && remainderOfHundred !== 11)
    return `${day}st`;
  if (remainderOfTen === 2 && remainderOfHundred !== 12)
    return `${day}nd`;
  if (remainderOfTen === 3 && remainderOfHundred !== 13)
    return `${day}rd`;
  return `${day}th`;
}
