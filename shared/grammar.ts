import { dateFromKey, dateKey, durationToken, parseDuration, shiftDate } from "./format.ts";
import type { Kind, Task, TaskPart } from "./model.ts";

export interface ParsedPart {
  name: string;
  kind: Kind;
  target: number;
  timer: number;
  note: string;
  current: number | null;
  value: string | null;
  done: boolean | null;
}

export interface ParsedTask extends ParsedPart {
  group: string | null;
  rest: number;
  every: string | null;
  date: string | null;
  time: string | null;
  parts: ParsedPart[];
}

export interface TokenSpan {
  from: number;
  to: number;
  kind: "attribute" | "bullet";
}

interface Line {
  words: string[];
  spans: TokenSpan[];
  group: string | null;
  kind: Kind | null;
  target: number | null;
  timer: number | null;
  rest: number | null;
  every: string | null;
  date: string | null;
  time: string | null;
  repeat: number;
  currentRaw: string | null;
}

interface DocumentLine {
  kind: "task" | "part" | "note" | "blank";
  text: string;
  from: number;
  bullet: number | null;
}

const dayList = /^(mo|tu|we|th|fr|sa|su)(,(mo|tu|we|th|fr|sa|su))*$/;
const interval = /^\d+[dwm]$/;
const weekdayNames: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const monthNames: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

function isTag(token: string): boolean {
  return /^[#/=]/.test(token);
}

function parseTime(token: string): string | null {
  const match = /^(\d{1,2})(?::(\d{2}))?(am|pm)?$/i.exec(token);
  if (!match || (!match[2] && !match[3])) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ?? "00";
  const suffix = match[3]?.toLowerCase();
  if (suffix === "pm" && hours < 12) hours += 12;
  if (suffix === "am" && hours === 12) hours = 0;
  if (hours > 23 || Number(minutes) > 59) return null;
  return String(hours).padStart(2, "0") + ":" + minutes;
}

function comingWeekday({ today, weekday }: { today: string; weekday: number }): string {
  const offset = ((weekday - dateFromKey(today).getDay() + 7) % 7) || 7;
  return shiftDate({ key: today, days: offset });
}

function parseLine({ text, today, from }: { text: string; today: string; from: number }): Line {
  const tokens: string[] = [];
  const starts: number[] = [];
  for (const match of text.matchAll(/\S+/g)) {
    tokens.push(match[0]);
    starts.push(from + match.index);
  }
  const attributes = new Set<number>();
  const line: Line = { words: [], spans: [], group: null, kind: null, target: null, timer: null, rest: null, every: null, date: null, time: null, repeat: 1, currentRaw: null };
  for (let index = 0; index < tokens.length; index += 1) {
    const opening = index;
    const token = tokens[index] ?? "";
    const next = tokens[index + 1];
    const lower = token.toLowerCase();
    if (token.startsWith("=")) {
      const pieces: string[] = [];
      if (token.length > 1) pieces.push(token.slice(1));
      attributes.add(index);
      while (tokens[index + 1] !== undefined && !isTag(tokens[index + 1] ?? "")) {
        pieces.push(tokens[++index] ?? "");
        attributes.add(index);
      }
      line.currentRaw = pieces.join(" ");
      continue;
    }
    if (token.startsWith("/") && token.length > 1) {
      line.group = token.slice(1).toLowerCase();
      attributes.add(index);
      continue;
    }
    if (token.startsWith("#")) {
      const key = lower.slice(1);
      if (key === "timer") {
        line.kind = "timer";
        if (next && !isTag(next) && parseDuration(next) !== null) {
          line.timer = parseDuration(tokens[++index] ?? "") ?? 0;
          attributes.add(index);
        }
      } else if (key === "count") {
        line.kind = "count";
        if (next && /^\d+$/.test(next)) {
          line.target = Number(tokens[++index]);
          attributes.add(index);
        }
      } else if (key === "text") {
        line.kind = "text";
      } else if (key === "rest") {
        if (next && !isTag(next) && parseDuration(next) !== null) {
          line.rest = parseDuration(tokens[++index] ?? "") ?? 0;
          attributes.add(index);
        }
      } else if (key === "every") {
        const pieces: string[] = [];
        while (tokens[index + 1] !== undefined && (interval.test(tokens[index + 1] ?? "") || dayList.test(tokens[index + 1] ?? ""))) {
          pieces.push(tokens[++index] ?? "");
          attributes.add(index);
        }
        line.every = pieces.join(" ") || "1d";
      } else {
        line.words.push(token);
        continue;
      }
      attributes.add(opening);
      continue;
    }
    const repeat = /^[×x](\d+)$/i.exec(token);
    if (repeat) {
      line.repeat = Math.max(1, Number(repeat[1]));
      attributes.add(index);
      continue;
    }
    if (lower === "today") {
      line.date = today;
      attributes.add(index);
      continue;
    }
    if (lower === "tomorrow") {
      line.date = shiftDate({ key: today, days: 1 });
      attributes.add(index);
      continue;
    }
    if (weekdayNames[lower] !== undefined) {
      line.date = comingWeekday({ today, weekday: weekdayNames[lower] ?? 0 });
      attributes.add(index);
      continue;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) {
      line.date = token;
      attributes.add(index);
      continue;
    }
    if (monthNames[lower] !== undefined && next && /^\d{1,2}$/.test(next)) {
      const month = monthNames[lower] ?? 1;
      const day = Number(next);
      const year = dateFromKey(today).getFullYear();
      let candidate = dateKey(new Date(year, month - 1, day));
      if (candidate < today) candidate = dateKey(new Date(year + 1, month - 1, day));
      line.date = candidate;
      attributes.add(index);
      index += 1;
      attributes.add(index);
      continue;
    }
    const time = parseTime(lower);
    if (time) {
      line.time = time;
      attributes.add(index);
      continue;
    }
    line.words.push(token);
  }
  for (const [index, token] of tokens.entries()) {
    if (attributes.has(index)) line.spans.push({ from: starts[index] ?? 0, to: (starts[index] ?? 0) + token.length, kind: "attribute" });
  }
  return line;
}

function documentLines(text: string): DocumentLine[] {
  const lines: DocumentLine[] = [];
  let at = 0;
  text.split("\n").forEach((line, index) => {
    const marker = /^\s*- /.exec(line);
    if (marker) lines.push({ kind: "part", text: line.slice(marker[0].length), from: at + marker[0].length, bullet: at + marker[0].length - 2 });
    else if (!line.trim()) lines.push({ kind: "blank", text: "", from: at, bullet: null });
    else if (index === 0) lines.push({ kind: "task", text: line, from: at, bullet: null });
    else lines.push({ kind: "note", text: line.trim(), from: at, bullet: null });
    at += line.length + 1;
  });
  return lines;
}

export function tokenSpans({ text, today }: { text: string; today: string }): TokenSpan[] {
  const spans: TokenSpan[] = [];
  for (const line of documentLines(text)) {
    if (line.bullet !== null) spans.push({ from: line.bullet, to: line.bullet + 1, kind: "bullet" });
    if (line.kind === "task" || line.kind === "part") spans.push(...parseLine({ text: line.text, today, from: line.from }).spans);
  }
  return spans;
}

function partFrom({ line, notes }: { line: Line; notes: string[] }): ParsedPart {
  const kind = line.kind ?? "boolean";
  const part: ParsedPart = {
    name: line.words.join(" "),
    kind,
    target: kind === "count" ? (line.target ?? 1) : 0,
    timer: kind === "timer" ? (line.timer ?? 0) : 0,
    note: notes.join("\n"),
    current: null,
    value: null,
    done: null,
  };
  const raw = line.currentRaw;
  if (raw === null) return part;
  if (/^(done|yes|x|true)$/i.test(raw)) part.done = true;
  else if (kind === "text") part.value = raw;
  else if (kind === "timer") part.current = parseDuration(raw) ?? 0;
  else if (kind === "count") part.current = Number.parseInt(raw, 10) || 0;
  return part;
}

export function parseTask({ text, today }: { text: string; today: string }): ParsedTask | null {
  const lines = documentLines(text);
  const first = lines[0];
  if (!first || first.kind !== "task") return null;
  const rootLine = parseLine({ text: first.text, today, from: first.from });
  if (rootLine.words.length === 0) return null;
  const rootNotes: string[] = [];
  const partLines: { line: Line; notes: string[] }[] = [];
  let current: { line: Line; notes: string[] } | null = null;
  for (const line of lines.slice(1)) {
    if (line.kind === "part") {
      current = { line: parseLine({ text: line.text, today, from: line.from }), notes: [] };
      partLines.push(current);
    } else if (line.kind === "note") {
      (current ? current.notes : rootNotes).push(line.text);
    }
  }
  const parts = partLines.flatMap(({ line, notes }) => {
    const part = partFrom({ line, notes });
    if (line.repeat === 1) return [part];
    return Array.from({ length: line.repeat }, (_, index) => ({ ...part, name: `${part.name} ${index + 1}`, current: null, value: null, done: null }));
  });
  return {
    ...partFrom({ line: rootLine, notes: rootNotes }),
    group: rootLine.group,
    rest: rootLine.rest ?? 0,
    every: rootLine.every,
    date: rootLine.date,
    time: rootLine.time,
    parts,
  };
}

function kindTokens(part: { kind: Kind; target: number; timer: number }): string {
  if (part.kind === "timer") return " #timer " + durationToken(part.timer);
  if (part.kind === "count") return " #count " + part.target;
  if (part.kind === "text") return " #text";
  return "";
}

function valueTokens(part: TaskPart | Task): string {
  if (part.doneAt && part.kind !== "text") return " = done";
  if (part.kind === "text") return part.value ? " = " + part.value : "";
  if (part.kind === "timer") return part.current ? " = " + durationToken(Math.round(part.current)) : "";
  if (part.kind === "count") return part.current ? " = " + part.current : "";
  return "";
}

function noteLines(note: string): string {
  return note ? "\n" + note.split("\n").map((line) => "  " + line).join("\n") : "";
}

export function serializeTask({ task, every, today }: { task: Task; every: string | null; today: string }): string {
  let text = task.group ? task.name + " /" + task.group : task.name;
  if (every) text += " #every " + every;
  if (task.parts.length === 0) text += kindTokens(task);
  if (task.rest) text += " #rest " + durationToken(task.rest);
  if (!every && task.date) text += " " + (task.date === today ? "today" : task.date === shiftDate({ key: today, days: 1 }) ? "tomorrow" : task.date);
  if (task.time) text += " " + task.time;
  if (task.parts.length === 0) text += valueTokens(task);
  else if (task.doneAt) text += " = done";
  if (task.note) text += "\n" + noteLines(task.note);
  if (task.note && task.parts.length > 0) text += "\n";
  for (const part of task.parts) text += "\n- " + part.name + kindTokens(part) + valueTokens(part) + noteLines(part.note);
  return text;
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
