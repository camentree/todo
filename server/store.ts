import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

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

  putDefinition(definition: Definition): Definition {
    const stored = { ...definition, id: definition.id ?? identifier() };
    const index = this.data.definitions.findIndex((each) => each.id === stored.id);
    if (index === -1) this.data.definitions.push(stored);
    else this.data.definitions[index] = stored;
    this.save();
    return stored;
  }

  deleteDefinition(id: string): void {
    this.data.definitions = this.data.definitions.filter((each) => each.id !== id);
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
      this.data.tasks.push({
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
      });
    }
    this.data.instantiated.push(date);
    this.save();
  }

  putTask(task: Task): Task {
    const stored = { ...task, id: task.id ?? identifier() };
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

export function parseMarkdown(markdown: string): JournalEntry[] {
  const blocks = markdown.split(/^## /m).slice(1);
  return blocks.map((block) => {
    const newline = block.indexOf("\n");
    const heading = (newline === -1 ? block : block.slice(0, newline)).trim();
    const lines = (newline === -1 ? "" : block.slice(newline + 1)).replace(/\n+$/, "");
    const metadata = lines.match(/^<!--\s*([\s\S]*?)\s*-->\n?/);
    const fields: Record<string, string> = {};
    for (const line of (metadata?.[1] ?? "").split("\n")) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const key = line.slice(0, colon).trim();
      if (key) fields[key] = line.slice(colon + 1).trim();
    }
    return {
      id: fields.id ?? heading,
      at: heading,
      tags: fields.tags ? fields.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
      task: fields.task || null,
      body: metadata ? lines.slice(metadata[0].length) : lines,
    };
  });
}

export function serializeMarkdown(entries: JournalEntry[]): string {
  return entries
    .map((entry) => {
      const metadata = [`id: ${entry.id}`, `tags: ${entry.tags.join(", ")}`, entry.task ? `task: ${entry.task}` : ""]
        .filter(Boolean)
        .join("\n");
      return `## ${entry.at}\n<!--\n${metadata}\n-->\n${entry.body}\n`;
    })
    .join("\n");
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
