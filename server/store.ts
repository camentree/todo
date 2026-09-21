import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { shiftDate } from "@shared/format.ts";
import { parseMarkdown, serializeMarkdown } from "@shared/journal.ts";
import { isDue } from "@shared/schedule.ts";
import { isNumericType } from "@shared/model.ts";
import type { Comment, JournalEntry, Schedule, SubtaskSpec, Task } from "@shared/model.ts";

type Row = Omit<Task, "subtasks" | "comments">;

interface Data {
  schedules: Schedule[];
  tasks: Row[];
  comments: Comment[];
  instantiated: string[];
}

const empty: Data = { schedules: [], tasks: [], comments: [], instantiated: [] };

export class Store {
  private data: Data;

  constructor(private readonly directory: string) {
    try {
      this.data = { ...empty, ...JSON.parse(readFileSync(join(directory, "parallax.json"), "utf8")) };
    } catch {
      this.data = structuredClone(empty);
    }
    // A file written before soft deletes has no deletedAt at all, and undefined would
    // fail every `deletedAt === null` test and hide the whole list.
    this.data.tasks = this.data.tasks.map((row) => ({ ...row, deletedAt: row.deletedAt ?? null }));
  }

  private save(): void {
    mkdirSync(this.directory, { recursive: true });
    const file = join(this.directory, "parallax.json");
    writeFileSync(file + ".tmp", JSON.stringify(this.data, null, 2));
    renameSync(file + ".tmp", file);
  }

  schedules(): Schedule[] {
    return [...this.data.schedules].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  }

  putSchedule({ schedule, today }: { schedule: Schedule; today: string }): Schedule {
    validateShape({ type: schedule.type, target: schedule.target, numericalValue: null, stringValue: null, restSeconds: schedule.restSeconds });
    for (const spec of schedule.subtasks ?? []) validateShape({ type: spec.type, target: spec.target, numericalValue: null, stringValue: null, restSeconds: spec.restSeconds });
    const existing = this.data.schedules.find((each) => each.id === schedule.id);
    const stored = { ...schedule, id: schedule.id ?? identifier(), createdAt: existing?.createdAt ?? new Date().toISOString() };
    const index = this.data.schedules.findIndex((each) => each.id === stored.id);
    if (index === -1) this.data.schedules.push(stored);
    else this.data.schedules[index] = stored;
    this.removeRows((row) => row.scheduleId === stored.id && row.dueDate !== null && row.dueDate > today);
    for (const date of this.data.instantiated) {
      if (date < today) continue;
      if (this.data.tasks.some((row) => row.scheduleId === stored.id && row.dueDate === date)) continue;
      if (isDue({ schedule: stored, date })) this.createInstance({ schedule: stored, date });
    }
    this.save();
    return stored;
  }

  deleteSchedule({ id, today }: { id: string; today: string }): void {
    this.removeRows((row) => row.scheduleId === id && row.dueDate !== null && row.dueDate >= today);
    this.data.schedules = this.data.schedules.filter((each) => each.id !== id);
    this.save();
  }

  tasks({ today, through }: { today: string; through: string | null }): Task[] {
    const last = through ?? shiftDate({ key: today, days: 6 });
    for (let date = today; date <= last; date = shiftDate({ key: date, days: 1 })) this.instantiate(date);
    const top = this.data.tasks
      .filter((row) => row.parentId === null && row.deletedAt === null)
      .sort((a, b) => ((a.dueDate === null ? 1 : 0) - (b.dueDate === null ? 1 : 0)) || (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return top.map((row) => this.assemble(row));
  }

  // A deleted parent keeps its deleted children, so a row in the recently deleted
  // list still reads as the task that was thrown away rather than an empty shell.
  deletedTasks({ since }: { since: string }): Task[] {
    return this.data.tasks
      .filter((row) => row.parentId === null && row.deletedAt !== null && row.deletedAt >= since)
      .sort((a, b) => (b.deletedAt ?? "").localeCompare(a.deletedAt ?? "") || a.id.localeCompare(b.id))
      .map((row) => this.assemble(row, { deleted: true }));
  }

  private assemble(row: Row, { deleted }: { deleted: boolean } = { deleted: false }): Task {
    const subtasks = this.data.tasks
      .filter((each) => each.parentId === row.id && (deleted || each.deletedAt === null))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
      .map((each) => ({ ...each, subtasks: [], comments: [] }));
    return { ...row, subtasks, comments: this.commentsFor(row) };
  }

  private commentsFor(row: Row): Comment[] {
    const owners =
      row.scheduleId === null
        ? new Set([row.id])
        : new Set(this.data.tasks.filter((each) => each.scheduleId === row.scheduleId && each.deletedAt === null).map((each) => each.id));
    return this.data.comments.filter((comment) => owners.has(comment.taskId)).sort((a, b) => a.writtenAt.localeCompare(b.writtenAt) || a.id.localeCompare(b.id));
  }

  private instantiate(date: string): void {
    if (this.data.instantiated.includes(date)) return;
    for (const schedule of this.data.schedules) {
      if (this.data.tasks.some((row) => row.scheduleId === schedule.id && row.dueDate === date)) continue;
      if (!isDue({ schedule, date })) continue;
      this.createInstance({ schedule, date });
    }
    this.data.instantiated.push(date);
    this.save();
  }

  private createInstance({ schedule, date }: { schedule: Schedule; date: string }): void {
    const parent: Row = {
      id: identifier(),
      parentId: null,
      scheduleId: schedule.id,
      dueDate: date,
      dueTime: schedule.dueTime,
      title: schedule.title,
      group: schedule.group,
      type: schedule.type,
      target: schedule.target,
      numericalValue: isNumericType(schedule.type) ? 0 : null,
      stringValue: schedule.type === "text" ? "" : null,
      restSeconds: schedule.restSeconds,
      finalizedAt: null,
      isSkipped: false,
      assignee: null,
      note: schedule.note,
      sortOrder: schedule.sortOrder,
      createdAt: new Date().toISOString(),
      deletedAt: null,
    };
    this.data.tasks.push(parent);
    schedule.subtasks.forEach((spec: SubtaskSpec, index: number) => {
      this.data.tasks.push({
        id: identifier(),
        parentId: parent.id,
        scheduleId: null,
        dueDate: null,
        dueTime: null,
        title: spec.title,
        group: schedule.group,
        type: spec.type,
        target: spec.target,
        numericalValue: isNumericType(spec.type) ? 0 : null,
        stringValue: spec.type === "text" ? "" : null,
        restSeconds: spec.restSeconds,
        finalizedAt: null,
        isSkipped: false,
        assignee: null,
        note: spec.note,
        sortOrder: spec.sortOrder ?? index,
        createdAt: new Date().toISOString(),
        deletedAt: null,
      });
    });
  }

  getTask(id: string): Task {
    const row = this.data.tasks.find((each) => each.id === id);
    if (!row) throw new Error(`no task with id ${id}`);
    return this.assemble(row);
  }

  putTask(task: Task & { subtasks?: Task[] }): Task {
    validateShape(task);
    for (const subtask of task.subtasks ?? []) validateShape(subtask);
    const existing = this.data.tasks.find((each) => each.id === task.id);
    const stored = rowOf({ ...task, id: task.id ?? identifier(), createdAt: existing?.createdAt ?? new Date().toISOString() });
    if (stored.scheduleId && stored.dueDate) {
      const duplicates = this.data.tasks.filter((each) => each.id !== stored.id && each.scheduleId === stored.scheduleId && each.dueDate === stored.dueDate);
      for (const duplicate of duplicates) this.removeRows((row) => row.id === duplicate.id);
    }
    this.upsert(stored);
    if (task.subtasks !== undefined) this.replaceSubtasks({ parent: stored, subtasks: task.subtasks });
    this.save();
    return this.getTask(stored.id);
  }

  private replaceSubtasks({ parent, subtasks }: { parent: Row; subtasks: Task[] }): void {
    const kept = subtasks.map((subtask) => subtask.id ?? identifier());
    this.markDeleted((row) => row.parentId === parent.id && !kept.includes(row.id));
    subtasks.forEach((subtask, index) => {
      const existing = this.data.tasks.find((each) => each.id === kept[index]);
      this.upsert({
        ...rowOf({ ...subtask, createdAt: existing?.createdAt ?? new Date().toISOString() }),
        id: kept[index] ?? identifier(),
        parentId: parent.id,
        scheduleId: null,
        group: subtask.group || parent.group,
        sortOrder: subtask.sortOrder ?? index,
      });
    });
  }

  private upsert(row: Row): void {
    const index = this.data.tasks.findIndex((each) => each.id === row.id);
    if (index === -1) this.data.tasks.push(row);
    else this.data.tasks[index] = row;
  }

  // removeRows drops rows the user never asked to delete: unreached recurrences of an
  // edited schedule, and duplicate instances. markDeleted is the one the user sees.
  private removeRows(matches: (row: Row) => boolean): void {
    const removed = new Set(this.data.tasks.filter(matches).map((row) => row.id));
    this.data.tasks = this.data.tasks.filter((row) => !removed.has(row.id) && !(row.parentId !== null && removed.has(row.parentId)));
  }

  private markDeleted(matches: (row: Row) => boolean): void {
    const deletedAt = new Date().toISOString();
    const gone = new Set(this.data.tasks.filter((row) => row.deletedAt === null && matches(row)).map((row) => row.id));
    this.data.tasks = this.data.tasks.map((row) =>
      row.deletedAt === null && (gone.has(row.id) || (row.parentId !== null && gone.has(row.parentId))) ? { ...row, deletedAt } : row,
    );
  }

  deleteTask(id: string): void {
    this.markDeleted((row) => row.id === id);
    this.save();
  }

  taskComments(taskId: string): Comment[] {
    const row = this.data.tasks.find((each) => each.id === taskId);
    if (!row) throw new Error(`no task with id ${taskId}`);
    return this.commentsFor(row);
  }

  createComment({ taskId, comment }: { taskId: string; comment: Partial<Comment> }): Comment {
    if (!this.data.tasks.some((each) => each.id === taskId)) throw new Error(`no task with id ${taskId}`);
    const stored: Comment = {
      id: comment.id ?? identifier(),
      taskId,
      body: comment.body ?? "",
      author: comment.author ?? "camen",
      writtenAt: comment.writtenAt ?? new Date().toISOString().slice(0, 19),
      seenAt: comment.seenAt ?? null,
      createdAt: new Date().toISOString(),
    };
    this.data.comments.push(stored);
    this.save();
    return stored;
  }

  updateComment({ id, comment }: { id: string; comment: Partial<Comment> }): Comment {
    const index = this.data.comments.findIndex((each) => each.id === id);
    const existing = this.data.comments[index];
    if (!existing) throw new Error(`no comment with id ${id}`);
    const stored: Comment = {
      ...existing,
      body: comment.body ?? existing.body,
      author: comment.author ?? existing.author,
      seenAt: comment.seenAt ?? existing.seenAt,
    };
    this.data.comments[index] = stored;
    this.save();
    return stored;
  }

  deleteComment(id: string): void {
    this.data.comments = this.data.comments.filter((each) => each.id !== id);
    this.save();
  }

  entries(name: string): JournalEntry[] {
    return this.allEntries(name).filter((entry) => entry.metadata.deletedAt === undefined);
  }

  // Writes work off every entry in the file, deleted ones included, so rewriting the
  // markdown after an edit does not quietly drop the entries that were thrown away.
  private allEntries(name: string): JournalEntry[] {
    return parseMarkdown(this.readMarkdown(name));
  }

  putEntry({ name, entry }: { name: string; entry: JournalEntry }): JournalEntry {
    const entries = this.allEntries(name).filter((each) => each.at !== entry.at);
    entries.push(entry);
    entries.sort((a, b) => a.at.localeCompare(b.at));
    this.writeMarkdown({ name, entries });
    return entry;
  }

  deleteEntry({ name, at }: { name: string; at: string }): void {
    const deletedAt = new Date().toISOString();
    const entries = this.allEntries(name).map((each) =>
      each.at === at && each.metadata.deletedAt === undefined ? { ...each, metadata: { ...each.metadata, deletedAt } } : each,
    );
    this.writeMarkdown({ name, entries });
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

function rowOf(task: Task): Row {
  return {
    id: task.id,
    parentId: task.parentId ?? null,
    scheduleId: task.scheduleId ?? null,
    dueDate: task.dueDate ?? null,
    dueTime: task.dueTime ?? null,
    title: task.title,
    group: task.group ?? "",
    type: task.type,
    target: task.target ?? null,
    numericalValue: task.numericalValue ?? (isNumericType(task.type) ? 0 : null),
    stringValue: task.stringValue ?? (task.type === "text" ? "" : null),
    restSeconds: task.restSeconds ?? null,
    finalizedAt: task.finalizedAt ?? null,
    isSkipped: task.isSkipped ?? false,
    assignee: task.assignee ?? null,
    note: task.note ?? "",
    sortOrder: task.sortOrder ?? 0,
    createdAt: task.createdAt,
    deletedAt: task.deletedAt ?? null,
  };
}

function validateShape({ type, target, numericalValue, stringValue, restSeconds }: Pick<Task, "type" | "target" | "numericalValue" | "stringValue" | "restSeconds">): void {
  if (isNumericType(type)) {
    if (target === null || target === undefined) throw new Error(`${type} needs a target`);
    if (target < 0) throw new Error("target cannot be negative");
  } else if (target !== null && target !== undefined) {
    throw new Error(`${type} cannot carry a target`);
  }
  if (stringValue !== null && stringValue !== undefined && type !== "text") throw new Error(`${type} cannot carry a stringValue`);
  if (numericalValue !== null && numericalValue !== undefined) {
    if (!isNumericType(type)) throw new Error(`${type} cannot carry a numericalValue`);
    if (numericalValue < 0) throw new Error("numericalValue cannot be negative");
  }
  if (restSeconds !== null && restSeconds !== undefined && restSeconds < 0) throw new Error("restSeconds cannot be negative");
}

function identifier(): string {
  return Math.random().toString(36).slice(2, 11);
}
