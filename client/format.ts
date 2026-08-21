import {
  format,
  isThisYear,
  isToday,
  isTomorrow,
  parseISO,
} from "date-fns";

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
  if (isToday(date)) {
    return "today";
  }
  if (isTomorrow(date)) {
    return "tomorrow";
  }
  return format(date, isThisYear(date) ? "EEE d MMM" : "d MMM yyyy");
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
