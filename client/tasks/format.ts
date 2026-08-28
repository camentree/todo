import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";

import type { WeekRuns } from "../data/settings.ts";
import type { AttributeField } from "@shared/attributes.ts";
import { asStage, stageLabel } from "@shared/stages.ts";
import type { Schedule } from "@shared/types.ts";

const NAMED_WEEKDAY_DAYS = 7;

export function asTitle(name: string): string {
  return name.replace(/(^|\s)\p{Ll}/gu, (start) =>
    start.toUpperCase(),
  );
}

export function formatDueDate(dueDate: string | null): string | null {
  if (!dueDate) {
    return null;
  }
  const date = parseISO(dueDate);
  if (isYesterday(date)) {
    return "yesterday";
  }
  if (isToday(date)) {
    return "today";
  }
  if (isTomorrow(date)) {
    return "tomorrow";
  }
  const days = differenceInCalendarDays(date, new Date());
  if (days > 1 && days <= NAMED_WEEKDAY_DAYS) {
    return format(date, "EEEE").toLowerCase();
  }
  return format(date, "yyyy-MM-dd");
}

const TIMES_A_WEEK: Record<number, string> = {
  2: "twice weekly",
  3: "three times weekly",
  4: "four times weekly",
  5: "five times weekly",
  6: "six times weekly",
  7: "daily",
};

export function cadenceOf(schedule: Schedule): string {
  const every = schedule.repeatEvery;

  if (schedule.frequency === "daily") {
    return every === 1 ? "daily" : `every ${every} days`;
  }

  if (schedule.frequency === "weekly") {
    if (every === 2) {
      return "bi-weekly";
    }
    if (every > 2) {
      return `every ${every} weeks`;
    }
    return TIMES_A_WEEK[schedule.weekdays.length] ?? "weekly";
  }

  return every === 1 ? "monthly" : `every ${every} months`;
}

export function formatDueTime(dueTime: string | null): string | null {
  if (!dueTime) {
    return null;
  }
  const [hours = "0", minutes = "0"] = dueTime.split(":");
  const date = new Date();
  date.setHours(
    Number.parseInt(hours, 10),
    Number.parseInt(minutes, 10),
  );
  return format(date, "h:mmaaa");
}

export function attributeText(
  attribute: AttributeField,
  value: string,
): string {
  if (attribute === "due_time") {
    return formatDueTime(value) ?? value;
  }
  if (attribute === "due_date") {
    return formatDueDate(value) ?? value;
  }
  if (attribute === "stage") {
    const stage = asStage(value);
    return stage ? stageLabel(stage) : value;
  }
  if (attribute === "recurring" || attribute === "archived") {
    return value === "true" ? attribute : `not ${attribute}`;
  }
  return value;
}

export function formatWhen(timestamp: string): string {
  const date = parseISO(timestamp);
  return isToday(date)
    ? format(date, "h:mmaaa")
    : format(date, "d MMM h:mmaaa");
}

export function isDueToday(dueDate: string | null): boolean {
  return dueDate !== null && isToday(parseISO(dueDate));
}

export function todayAsDateString(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function weekEndsOn(weekRuns: WeekRuns): string {
  const last =
    weekRuns === "calendar"
      ? endOfWeek(new Date(), { weekStartsOn: 1 })
      : addDays(new Date(), 6);
  return format(last, "yyyy-MM-dd");
}
