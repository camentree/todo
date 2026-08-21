import {
  addDays,
  differenceInCalendarDays,
  format,
  isToday,
  isTomorrow,
  isYesterday,
  parseISO,
} from "date-fns";

import type { Attribute } from "@shared/attributes.ts";
import { asStage, stageLabel } from "@shared/stages.ts";

const NAMED_WEEKDAY_DAYS = 7;

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

export function dueDateFromLabel(label: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) {
    return label;
  }
  const today = new Date();
  for (
    let offset = -1;
    offset <= NAMED_WEEKDAY_DAYS;
    offset = offset + 1
  ) {
    const date = addDays(today, offset);
    if (formatDueDate(format(date, "yyyy-MM-dd")) === label) {
      return format(date, "yyyy-MM-dd");
    }
  }
  return null;
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
  attribute: Attribute,
  value: string,
): string {
  if (attribute === "due_time") {
    return formatDueTime(value) ?? value;
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
