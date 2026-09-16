export function formatDuration(seconds: number): string {
  if (seconds >= 3600) return (seconds / 3600).toFixed(seconds % 3600 ? 1 : 0) + " h";
  if (seconds >= 60) return Math.round(seconds / 60) + " min";
  return seconds + "s";
}

export function formatClock(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes + ":" + String(rest).padStart(2, "0");
}

export function durationToken(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) return seconds / 3600 + "h";
  if (seconds >= 60 && seconds % 60 === 0) return seconds / 60 + "m";
  return seconds + "s";
}

export function parseDuration(token: string): number | null {
  const match = /^(\d+(?:\.\d+)?)(h|m|s)?$/.exec(token);
  if (!match) return null;
  const amount = parseFloat(match[1] ?? "0");
  if (match[2] === "h") return amount * 3600;
  if (match[2] === "s") return amount;
  return amount * 60;
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function shiftDate({ key, days }: { key: string; days: number }): string {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function daysBetween({ from, to }: { from: string; to: string }): number {
  const start = dateFromKey(from);
  const end = dateFromKey(to);
  return Math.round((Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000);
}

export function formatTime(time: string): string {
  const [hoursText, minutesText] = time.split(":");
  const hours = Number(hoursText);
  const suffix = hours < 12 ? "am" : "pm";
  const clock = hours % 12 || 12;
  return minutesText && minutesText !== "00" ? `${clock}:${minutesText}${suffix}` : `${clock}${suffix}`;
}

export function fullDate(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-US", { month: "long", day: "numeric" }).toLowerCase();
}

export function longDate(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toLowerCase();
}

export function weekdayName(key: string): string {
  return dateFromKey(key).toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
}

export function dayLabel({ key, today }: { key: string; today: string }): string {
  if (key === today) return "today";
  if (key === shiftDate({ key: today, days: -1 })) return "yesterday";
  return Math.abs(daysBetween({ from: today, to: key })) <= 6 ? weekdayName(key) : fullDate(key);
}

export function formatWhen({ at, today }: { at: string; today: string }): string {
  const day = dayLabel({ key: at.slice(0, 10), today });
  return at.length >= 16 ? day + " " + formatTime(at.slice(11, 16)) : day;
}
