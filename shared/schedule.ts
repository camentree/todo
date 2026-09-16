import { dateFromKey, dateKey } from "./format.ts";

const dayIndex: Record<string, number> = { su: 0, mo: 1, tu: 2, we: 3, th: 4, fr: 5, sa: 6 };

function daysBetween({ from, to }: { from: Date; to: Date }): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86400000);
}

export function isDue({ every, anchor, date }: { every: string; anchor: string; date: string }): boolean {
  const day = dateFromKey(date);
  const start = dateFromKey(anchor);
  const elapsed = daysBetween({ from: start, to: day });
  if (elapsed < 0) return false;
  const parts = every.split(" ");
  const intervalPart = parts.map((part) => /^(\d+)([dwm])$/.exec(part)).find(Boolean);
  const days = parts
    .filter((part) => !/^\d+[dwm]$/.test(part))
    .flatMap((part) => part.split(","))
    .map((name) => dayIndex[name])
    .filter((index): index is number => index !== undefined);
  if (!intervalPart && days.length === 0) return false;
  const daysOk = days.length === 0 || days.includes(day.getDay());
  if (!intervalPart) return daysOk;
  const count = Number(intervalPart[1]);
  const unit = intervalPart[2];
  if (unit === "d") return daysOk && elapsed % count === 0;
  if (unit === "w") {
    if (days.length) return daysOk && Math.floor(elapsed / 7) % count === 0;
    return elapsed % (7 * count) === 0;
  }
  const months = (day.getFullYear() - start.getFullYear()) * 12 + day.getMonth() - start.getMonth();
  return daysOk && day.getDate() === start.getDate() && months % count === 0;
}

export function nextDue({ every, anchor, after }: { every: string; anchor: string; after: string }): string | null {
  const start = dateFromKey(after);
  for (let offset = 1; offset <= 366; offset++) {
    const candidate = new Date(start);
    candidate.setDate(start.getDate() + offset);
    if (isDue({ every, anchor, date: dateKey(candidate) })) return dateKey(candidate);
  }
  return null;
}
