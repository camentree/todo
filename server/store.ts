import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { parseMarkdown, serializeMarkdown } from "@shared/journal.ts";
import { isDue } from "@shared/schedule.ts";
import type { Comment, Definition, JournalEntry, Task } from "@shared/model.ts";

interface Data {
  definitions: Definition[];
  tasks: Task[];
  comments: Comment[];
  instantiated: string[];
}

const empty: Data = { definitions: [], tasks: [], comments: [], instantiated: [] };

export class Store {
  private data: Data;

  constructor(private readonly directory: string) {
    try {
      this.data = { ...empty, ...JSON.parse(readFileSync(join(directory, "parallax.json"), "utf8")) };
    } catch {
      this.data = structuredClone(empty);
    }
  }

  private save(): void {
    mkdirSync(this.directory, { recursive: true });
    const file = join(this.directory, "parallax.json");
    writeFileSync(file + ".tmp", JSON.stringify(this.data, null, 2));
    renameSync(file + ".tmp", file);
  }

  definitions(): Definition[] {
    return this.data.definitions;
  }

  putDefinition({ definition, today }: { definition: Definition; today: string }): Definition {
    const stored = { ...definition, id: definition.id ?? identifier() };
    const index = this.data.definitions.findIndex((each) => each.id === stored.id);
    if (index === -1) this.data.definitions.push(stored);
    else this.data.definitions[index] = stored;
    this.data.tasks = this.data.tasks.filter((task) => !(task.definitionId === stored.id && task.date !== null && task.date > today));
    for (const date of this.data.instantiated) {
      if (date < today) continue;
      if (this.data.tasks.some((task) => task.definitionId === stored.id && task.date === date)) continue;
      if (isDue({ every: stored.every, anchor: stored.anchor, date })) this.data.tasks.push(instanceOf({ definition: stored, date }));
    }
    this.save();
    return stored;
  }

  deleteDefinition({ id, today }: { id: string; today: string }): void {
    this.data.definitions = this.data.definitions.filter((each) => each.id !== id);
    this.data.tasks = this.data.tasks.filter((task) => !(task.definitionId === id && task.date !== null && task.date >= today));
    this.save();
  }

  tasks(through: string): Task[] {
    for (const date of datesUpTo(through)) this.instantiate(date);
    return this.data.tasks;
  }

  private instantiate(date: string): void {
    if (this.data.instantiated.includes(date)) return;
    for (const definition of this.data.definitions) {
      if (definition.ended && definition.ended <= date) continue;
      if (definition.created > date) continue;
      if (!isDue({ every: definition.every, anchor: definition.anchor, date })) continue;
      this.data.tasks.push(instanceOf({ definition, date }));
    }
    this.data.instantiated.push(date);
    this.save();
  }

  putTask(task: Task): Task {
    const stored = { ...task, id: task.id ?? identifier() };
    if (stored.definitionId && stored.date) {
      this.data.tasks = this.data.tasks.filter((each) => each.id === stored.id || each.definitionId !== stored.definitionId || each.date !== stored.date);
    }
    const index = this.data.tasks.findIndex((each) => each.id === stored.id);
    if (index === -1) this.data.tasks.push(stored);
    else this.data.tasks[index] = stored;
    this.save();
    return stored;
  }

  deleteTask(id: string): void {
    this.data.tasks = this.data.tasks.filter((each) => each.id !== id);
    this.save();
  }

  comments(): Comment[] {
    return this.data.comments;
  }

  putComment(comment: Comment): Comment {
    const stored = { ...comment, id: comment.id ?? identifier() };
    const index = this.data.comments.findIndex((each) => each.id === stored.id);
    if (index === -1) this.data.comments.push(stored);
    else this.data.comments[index] = stored;
    this.save();
    return stored;
  }

  deleteComment(id: string): void {
    this.data.comments = this.data.comments.filter((each) => each.id !== id);
    this.save();
  }

  entries(name: string): JournalEntry[] {
    return parseMarkdown(this.readMarkdown(name));
  }

  putEntry({ name, entry }: { name: string; entry: JournalEntry }): JournalEntry {
    const stored = { ...entry, id: entry.id ?? identifier() };
    const entries = this.entries(name).filter((each) => each.id !== stored.id);
    entries.push(stored);
    entries.sort((a, b) => a.at.localeCompare(b.at));
    this.writeMarkdown({ name, entries });
    return stored;
  }

  deleteEntry({ name, id }: { name: string; id: string }): void {
    this.writeMarkdown({ name, entries: this.entries(name).filter((each) => each.id !== id) });
  }

  private readMarkdown(name: string): string {
    const file = join(this.directory, `${journalFile(name)}.md`);
    return existsSync(file) ? readFileSync(file, "utf8") : "";
  }

  private writeMarkdown({ name, entries }: { name: string; entries: JournalEntry[] }): void {
    mkdirSync(this.directory, { recursive: true });
    writeFileSync(join(this.directory, `${journalFile(name)}.md`), serializeMarkdown(entries));
  }
}

const journals = ["journal", "notebook"];

function journalFile(name: string): string {
  if (!journals.includes(name)) throw new Error(`no journal named ${name}`);
  return name;
}

function instanceOf({ definition, date }: { definition: Definition; date: string }): Task {
  return {
    id: identifier(),
    definitionId: definition.id,
    date,
    time: definition.time,
    name: definition.name,
    group: definition.group,
    kind: definition.kind,
    target: definition.target,
    timer: definition.timer,
    rest: definition.rest,
    current: 0,
    value: "",
    doneAt: null,
    note: definition.note,
    parts: definition.parts.map((part) => ({ ...part, current: 0, value: "", doneAt: null })),
    sort: definition.sort,
    created: `${date}T00:00:00`,
  };
}

function datesUpTo(through: string): string[] {
  const dates: string[] = [];
  const end = new Date(through + "T00:00:00");
  for (let offset = 0; offset < 7; offset += 1) {
    const date = new Date(end);
    date.setDate(end.getDate() + offset);
    dates.push(date.toLocaleDateString("sv-SE"));
  }
  return dates;
}

function identifier(): string {
  return Math.random().toString(36).slice(2, 11);
}
