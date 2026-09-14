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

export function formatWhen({ at, now }: { at: Date; now: Date }): string {
  const sameDay = at.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const hours = at.getHours();
  const clock =
    (hours % 12 || 12) + ":" + String(at.getMinutes()).padStart(2, "0") + (hours < 12 ? "am" : "pm");
  if (sameDay) return clock;
  if (at.toDateString() === yesterday.toDateString()) return "yesterday " + clock;
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" }).toLowerCase() + " " + clock;
}

export function capitalise(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
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
