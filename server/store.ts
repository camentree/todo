import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { instantiate } from "@shared/tasks.ts";
import { isDue } from "@shared/schedule.ts";
import type { Comment, DayState, Definition, JournalEntry, Task } from "@shared/types.ts";

interface Data {
  definitions: Definition[];
  days: Record<string, Task[]>;
  entries: JournalEntry[];
  comments: Comment[];
}

const empty: Data = { definitions: [], days: {}, entries: [], comments: [] };

export class Store {
  private data: Data;

  constructor(private readonly file: string) {
    try {
      this.data = { ...empty, ...JSON.parse(readFileSync(file, "utf8")) };
    } catch {
      this.data = structuredClone(empty);
    }
  }

  private save(): void {
    mkdirSync(dirname(this.file), { recursive: true });
    const temporary = this.file + ".tmp";
    writeFileSync(temporary, JSON.stringify(this.data, null, 2));
    renameSync(temporary, this.file);
  }

  day(date: string): DayState {
    if (!this.data.days[date]) {
      const due = this.data.definitions.filter((definition) => isDue({ every: definition.every, anchor: definition.anchor, date }));
      this.data.days[date] = due.flatMap((definition) => instantiate({ definition, date }));
      this.save();
    }
    return {
      date,
      tasks: this.data.days[date] ?? [],
      definitions: this.data.definitions,
      entries: this.data.entries,
      comments: this.data.comments,
    };
  }

  putTasks({ date, tasks }: { date: string; tasks: Task[] }): void {
    this.data.days[date] = tasks;
    this.save();
  }

  putDefinitions(definitions: Definition[]): void {
    this.data.definitions = definitions;
    this.save();
  }

  addEntry(entry: JournalEntry): void {
    this.data.entries.unshift(entry);
    this.save();
  }

  updateEntry(entry: JournalEntry): void {
    this.data.entries = this.data.entries.map((each) => (each.id === entry.id ? entry : each));
    this.save();
  }

  deleteEntry(id: string): void {
    this.data.entries = this.data.entries.filter((each) => each.id !== id);
    this.save();
  }

  addComment(comment: Comment): void {
    this.data.comments.unshift(comment);
    this.save();
  }
}
