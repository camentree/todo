import { api } from "./api.ts";
import type { TaskState } from "@shared/states.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

const DEPTH = 20;
const SAME_EDIT_MILLISECONDS = 2000;

interface HistoryEntry {
  taskId: number;
  at: number;
  coalescing: boolean;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const done: HistoryEntry[] = [];
const undone: HistoryEntry[] = [];

function record({
  taskId,
  undo,
  redo,
  coalescing = false,
}: {
  taskId: number;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  coalescing?: boolean;
}): void {
  undone.length = 0;
  const at = Date.now();
  const previous = done[done.length - 1];
  if (
    coalescing &&
    previous?.coalescing &&
    previous.taskId === taskId &&
    at - previous.at < SAME_EDIT_MILLISECONDS
  ) {
    done[done.length - 1] = {
      taskId: taskId,
      at: at,
      coalescing: true,
      undo: previous.undo,
      redo: redo,
    };
    return;
  }
  done.push({
    taskId: taskId,
    at: at,
    coalescing: coalescing,
    undo: undo,
    redo: redo,
  });
  if (done.length > DEPTH) {
    done.shift();
  }
}

function fieldsOf(task: CreatedTask): Partial<Task> & {
  list: string;
  title: string;
} {
  return {
    list: task.list,
    title: task.title,
    note: task.note,
    parentId: task.parentId,
    stage: task.stage,
    tags: task.tags,
    who: task.who,
    dueDate: task.dueDate,
    dueTime: task.dueTime,
  };
}

export function recordEdit({
  task,
  changes,
}: {
  task: CreatedTask;
  changes: Partial<Task>;
}): void {
  const before = Object.fromEntries(
    Object.keys(changes).map((field) => [
      field,
      task[field as keyof Task],
    ]),
  ) as Partial<Task>;
  if (Object.keys(before).length === 0) {
    return;
  }
  record({
    taskId: task.id,
    coalescing: true,
    undo: async () => void (await api.updateTask(task.id, before)),
    redo: async () => void (await api.updateTask(task.id, changes)),
  });
}

export function recordStateChange({
  task,
  next,
}: {
  task: CreatedTask;
  next: TaskState;
}): void {
  record({
    taskId: task.id,
    undo: async () => void (await api.setState(task.id, task.state)),
    redo: async () => void (await api.setState(task.id, next)),
  });
}

export function recordArchiving({
  task,
  archiving,
}: {
  task: CreatedTask;
  archiving: boolean;
}): void {
  const away = async () => void (await api.archiveTasks([task.id]));
  const back = async () => void (await api.unarchiveTasks([task.id]));
  record({
    taskId: task.id,
    undo: archiving ? back : away,
    redo: archiving ? away : back,
  });
}

export function recordHiding({
  task,
  hiding,
}: {
  task: CreatedTask;
  hiding: boolean;
}): void {
  const away = async () => void (await api.hideTask(task.id));
  const back = async () => void (await api.unhideTask(task.id));
  record({
    taskId: task.id,
    undo: hiding ? back : away,
    redo: hiding ? away : back,
  });
}

export function recordDeferral(task: CreatedTask): void {
  record({
    taskId: task.id,
    undo: async () =>
      void (await api.updateTask(task.id, {
        dueDate: task.dueDate,
      })),
    redo: async () => void (await api.deferTask(task.id)),
  });
}

export function recordDeletion(task: CreatedTask): void {
  let living = task;
  record({
    taskId: task.id,
    undo: async () => {
      living = await api.createTask(fieldsOf(living));
    },
    redo: async () => {
      await api.deleteTask(living.id);
    },
  });
}

export async function undo(): Promise<boolean> {
  const entry = done.pop();
  if (!entry) {
    return false;
  }
  undone.push(entry);
  await entry.undo();
  return true;
}

export async function redo(): Promise<boolean> {
  const entry = undone.pop();
  if (!entry) {
    return false;
  }
  done.push(entry);
  await entry.redo();
  return true;
}
