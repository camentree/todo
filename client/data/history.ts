import { api } from "../data/api.ts";
import type { CreatedTask, Task } from "@shared/types.ts";

const DEPTH = 20;
const SAME_EDIT_MILLISECONDS = 2000;

export interface Edit {
  before: CreatedTask | null;
  after: CreatedTask | null;
}

interface Held extends Edit {
  taskId: number;
}

interface Change {
  edits: Held[];
  at: number;
  coalescing: boolean;
}

const done: Change[] = [];
const undone: Change[] = [];

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
    state: task.state,
    archivedAt: task.archivedAt,
    resolvedAt: task.resolvedAt,
  };
}

function sameTask(left: Change, right: Held[]): boolean {
  return (
    left.edits.length === 1 &&
    right.length === 1 &&
    left.edits[0]?.taskId === right[0]?.taskId
  );
}

export function record({
  edits,
  coalescing = false,
}: {
  edits: Edit[];
  coalescing?: boolean;
}): void {
  const held = edits.flatMap((edit): Held[] => {
    const taskId = edit.after?.id ?? edit.before?.id;
    return taskId === undefined ? [] : [{ ...edit, taskId: taskId }];
  });
  if (held.length === 0) {
    return;
  }

  undone.length = 0;
  const at = Date.now();
  const previous = done[done.length - 1];

  if (
    coalescing &&
    previous?.coalescing &&
    sameTask(previous, held) &&
    at - previous.at < SAME_EDIT_MILLISECONDS
  ) {
    const carried = previous.edits[0];
    const arriving = held[0];
    if (carried && arriving) {
      carried.after = arriving.after;
      previous.at = at;
      return;
    }
  }

  done.push({ edits: held, at: at, coalescing: coalescing });
  if (done.length > DEPTH) {
    done.shift();
  }
}

async function restore(
  edit: Held,
  target: CreatedTask | null,
  living: boolean,
): Promise<void> {
  if (target === null) {
    await api.deleteTask(edit.taskId);
    return;
  }

  if (!living) {
    const revived = await api.createTask(fieldsOf(target));
    edit.taskId = revived.id;
    for (const subtask of target.subtasks ?? []) {
      await api.createTask({
        ...fieldsOf(subtask),
        parentId: revived.id,
      });
    }
    return;
  }

  await api.updateTask(edit.taskId, fieldsOf(target));
  for (const subtask of target.subtasks ?? []) {
    await api.updateTask(subtask.id, fieldsOf(subtask));
  }
}

export async function undo(): Promise<boolean> {
  const change = done.pop();
  if (!change) {
    return false;
  }
  undone.push(change);
  for (const edit of change.edits) {
    await restore(edit, edit.before, edit.after !== null);
  }
  return true;
}

export async function redo(): Promise<boolean> {
  const change = undone.pop();
  if (!change) {
    return false;
  }
  done.push(change);
  for (const edit of change.edits) {
    await restore(edit, edit.after, edit.before !== null);
  }
  return true;
}
