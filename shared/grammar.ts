import { durationToken, parseDuration } from "./format.ts";
import type { Definition, DefinitionChild, Kind, TaskType } from "./types.ts";
import { typeOfKind } from "./types.ts";

export interface ParsedLine {
  title: string;
  group: string | null;
  kind: Kind | null;
  target: number | null;
  unit: string;
  rest: number | null;
  every: string | null;
  currentRaw: string | null;
}

export interface ParsedTask {
  title: string;
  type: TaskType;
  kind: Kind;
  target: number;
  unit: string;
  rest: number;
  note: string;
  tapIncrement: boolean;
  current: number | null;
  value: string | null;
  doneManual: boolean | null;
}

export interface ParsedEntry extends ParsedTask {
  group: string;
  every: string | null;
  children: ParsedTask[];
}

const dayList = /^(mo|tu|we|th|fr|sa|su)(,(mo|tu|we|th|fr|sa|su))*$/;
const interval = /^\d+[dwm]$/;

function isTag(token: string): boolean {
  return /^[#/@=]/.test(token);
}

export function parseLine(line: string): ParsedLine {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  const parsed: ParsedLine = {
    title: "",
    group: null,
    kind: null,
    target: null,
    unit: "",
    rest: null,
    every: null,
    currentRaw: null,
  };
  const titleWords: string[] = [];
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? "";
    const next = tokens[index + 1];
    if (token.startsWith("=")) {
      const parts: string[] = [];
      if (token.length > 1) parts.push(token.slice(1));
      while (tokens[index + 1] !== undefined && !isTag(tokens[index + 1] ?? "")) parts.push(tokens[++index] ?? "");
      parsed.currentRaw = parts.join(" ");
      continue;
    }
    if (token.startsWith("/")) {
      parsed.group = token.slice(1).toLowerCase();
      continue;
    }
    if (token.startsWith("@")) continue;
    if (token.startsWith("#")) {
      const key = token.slice(1).toLowerCase();
      if (key === "timer") {
        parsed.kind = "timer";
        parsed.unit = "s";
        if (next && !isTag(next)) {
          parsed.target = parseDuration(next) ?? 0;
          index++;
        }
      } else if (key === "count") {
        parsed.kind = "count";
        if (next && /^\d+$/.test(next)) {
          parsed.target = Number(next);
          index++;
        }
      } else if (key === "amount" || key === "weight") {
        parsed.kind = key;
        if (next && !isTag(next)) {
          const match = /^(\d+(?:\.\d+)?)([a-z]*)$/i.exec(next);
          if (match) {
            parsed.target = Number(match[1]);
            parsed.unit = match[2] ?? "";
            index++;
          }
        }
      } else if (key === "text") {
        parsed.kind = "text";
      } else if (key === "rest") {
        if (next && !isTag(next)) {
          parsed.rest = parseDuration(next) ?? 0;
          index++;
        }
      } else if (key === "every") {
        const parts: string[] = [];
        while (
          tokens[index + 1] !== undefined &&
          (interval.test(tokens[index + 1] ?? "") || dayList.test(tokens[index + 1] ?? ""))
        ) {
          parts.push(tokens[++index] ?? "");
        }
        parsed.every = parts.join(" ") || "1d";
      }
      continue;
    }
    titleWords.push(token);
  }
  parsed.title = titleWords.join(" ");
  return parsed;
}

function finish({ line, notes, isChild, childCount }: { line: ParsedLine; notes: string[]; isChild: boolean; childCount: number }): ParsedTask {
  let kind = line.kind;
  let target = line.target;
  let tapIncrement = false;
  if (!kind) {
    if (!isChild && childCount > 0) {
      kind = "count";
      target = childCount;
    } else {
      kind = "bool";
    }
  }
  if (kind === "count" && target === null) {
    target = 1;
    tapIncrement = true;
  }
  if (target === null) target = kind === "bool" || kind === "text" ? 1 : 0;
  const task: ParsedTask = {
    title: line.title || "Untitled",
    type: typeOfKind(kind),
    kind,
    target,
    unit: line.unit,
    rest: line.rest ?? 0,
    note: notes.join("\n\n"),
    tapIncrement,
    current: null,
    value: null,
    doneManual: null,
  };
  const raw = line.currentRaw;
  if (raw !== null) {
    if (kind === "bool") task.doneManual = /^(done|yes|x|1|true)$/i.test(raw);
    else if (kind === "text") task.value = raw;
    else if (kind === "timer") task.current = parseDuration(raw) ?? 0;
    else {
      const amount = parseFloat(raw);
      task.current = Number.isNaN(amount) ? 0 : amount;
    }
  }
  return task;
}

export function parseEntry(text: string): ParsedEntry | null {
  const lines = text.replace(/\r/g, "").split("\n");
  const firstLine = lines[0];
  if (!firstLine || !firstLine.trim()) return null;
  const rootLine = parseLine(firstLine);
  const rootNotes: string[] = [];
  const childLines: { line: ParsedLine; notes: string[] }[] = [];
  let currentChild: { line: ParsedLine; notes: string[] } | null = null;
  for (const line of lines.slice(1)) {
    if (/^- /.test(line)) {
      currentChild = { line: parseLine(line.slice(2)), notes: [] };
      childLines.push(currentChild);
    } else if (currentChild && /^\s+\S/.test(line)) {
      currentChild.notes.push(line.trim());
    } else if (line.trim()) {
      currentChild = null;
      rootNotes.push(line.trim());
    } else {
      currentChild = null;
    }
  }
  const root = finish({ line: rootLine, notes: rootNotes, isChild: false, childCount: childLines.length });
  const children = childLines.map((child) => finish({ line: child.line, notes: child.notes, isChild: true, childCount: 0 }));
  return { ...root, group: rootLine.group ?? "personal", every: rootLine.every, children };
}

interface SerializableTask {
  name: string;
  kind: Kind;
  target: number;
  unit: string;
  tapIncrement: boolean;
  current: number;
  value: string;
  done: boolean;
  note: string;
}

function kindTag(task: SerializableTask): string {
  if (task.kind === "timer") return " #timer " + durationToken(task.target);
  if (task.kind === "count") return task.tapIncrement ? " #count" : " #count " + task.target;
  if (task.kind === "amount" || task.kind === "weight") return " #" + task.kind + " " + task.target + task.unit;
  if (task.kind === "text") return " #text";
  return "";
}

function currentTag(task: SerializableTask): string {
  if (task.kind === "bool") return task.done ? " = done" : "";
  if (task.kind === "text") return task.value ? " = " + task.value : "";
  if (task.kind === "timer") return task.current ? " = " + durationToken(Math.round(task.current)) : "";
  return task.current ? " = " + task.current : "";
}

export function serializeEntry({
  root,
  children,
  group,
  every,
  rest,
}: {
  root: SerializableTask;
  children: SerializableTask[];
  group: string;
  every: string | null;
  rest: number;
}): string {
  let text = root.name + (every ? " #every " + every : "") + " /" + (group || "personal") + (rest ? " #rest " + durationToken(rest) : "");
  if (children.length === 0) text += kindTag(root) + currentTag(root);
  if (root.note) text += "\n\n" + root.note;
  if (children.length) {
    text +=
      "\n\n" +
      children
        .map((child) => "- " + child.name + kindTag(child) + currentTag(child) + (child.note ? "\n  " + child.note : ""))
        .join("\n");
  }
  return text;
}

export function serializeDefinition(definition: Definition): string {
  const blank = { current: 0, value: "", done: false };
  const child = (part: DefinitionChild): SerializableTask => ({ ...blank, ...part, tapIncrement: false });
  return serializeEntry({
    root: { ...blank, name: definition.name, kind: definition.kind, target: definition.target, unit: definition.unit, tapIncrement: definition.tapIncrement, note: definition.note },
    children: definition.children.map(child),
    group: definition.group,
    every: definition.every,
    rest: definition.rest,
  });
}

export function everyLabel(every: string | null): string {
  if (!every) return "";
  const singular: Record<string, string> = { d: "every day", w: "every week", m: "every month" };
  const plural: Record<string, string> = { d: "days", w: "weeks", m: "months" };
  return every
    .split(" ")
    .map((part) => {
      const match = /^(\d+)([dwm])$/.exec(part);
      if (match) return match[1] === "1" ? singular[match[2] ?? "d"] : "every " + match[1] + " " + plural[match[2] ?? "d"];
      return "every " + part.split(",").join(", ");
    })
    .join(" · ");
}
