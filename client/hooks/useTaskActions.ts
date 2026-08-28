import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api } from "../data/api.ts";
import { recordFailure } from "../data/failures.ts";
import {
  record,
  redo as redoLast,
  undo as undoLast,
} from "../data/history.ts";
import {
  cancelNewest,
  DEBOUNCED_MILLISECONDS,
  defer,
  HOLD_MILLISECONDS,
  NO_DELAY,
  pendingFor,
  withChanges,
} from "../data/pending.ts";
import { asChanges } from "../tasks/attributes.ts";
import type { Attribute } from "../tasks/attributes.ts";
import { isDueToday, todayAsDateString } from "../tasks/format.ts";
import { findTask, TASKS_KEY } from "./useTasks.ts";
import { canonicalName } from "@shared/names.ts";
import { reassignSlots } from "@shared/ordering.ts";
import type { TaskStage } from "@shared/stages.ts";
import { isTerminal, type TaskState } from "@shared/states.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

const LAST_LIST_KEY = "todo.lastList";
const LAST_IN_ORDER = Number.MAX_SAFE_INTEGER;

let provisionalTasks = 0;

function provisionalTask(
  written: Partial<Task> & { title: string; list: string },
): CreatedTask {
  provisionalTasks += 1;
  const now = new Date().toISOString();
  return {
    parentId: null,
    recurringTaskId: null,
    note: null,
    state: "to_do",
    stage: null,
    tags: [],
    who: null,
    dueDate: null,
    dueTime: null,
    finishedAt: null,
    commentCount: 0,
    schedule: null,
    subtasks: [],
    ...written,
    id: -provisionalTasks,
    sortOrder: LAST_IN_ORDER,
    createdAt: now,
    updatedAt: now,
  };
}

function rememberList(list: string): void {
  window.localStorage.setItem(LAST_LIST_KEY, list);
}

function lastUsedList(): string | null {
  return window.localStorage.getItem(LAST_LIST_KEY);
}

function looksLikeTasks(value: unknown): value is CreatedTask[] {
  return (
    Array.isArray(value) &&
    (value.length === 0 ||
      (typeof value[0] === "object" &&
        value[0] !== null &&
        "state" in value[0] &&
        "list" in value[0]))
  );
}

function patched({
  tasks,
  id,
  changes,
}: {
  tasks: CreatedTask[];
  id: number;
  changes: Partial<Task>;
}): CreatedTask[] {
  return tasks.map((task): CreatedTask => {
    const subtasks = task.subtasks
      ? patched({ tasks: task.subtasks, id: id, changes: changes })
      : task.subtasks;

    if (task.id !== id) {
      return { ...task, subtasks: subtasks };
    }

    return {
      ...task,
      ...changes,
      id: task.id,
      list: changes.list ?? task.list,
    };
  });
}

function without(tasks: CreatedTask[], ids: number[]): CreatedTask[] {
  return tasks
    .filter((task) => !ids.includes(task.id))
    .map((task) =>
      task.subtasks
        ? { ...task, subtasks: without(task.subtasks, ids) }
        : task,
    );
}

function relocated({
  tasks,
  taskId,
  parentId,
}: {
  tasks: CreatedTask[];
  taskId: number;
  parentId: number | null;
}): CreatedTask[] {
  const taken = findTask(tasks, taskId);
  if (!taken) {
    return tasks;
  }
  const moved = { ...taken, parentId: parentId };
  const rest = without(tasks, [taskId]);
  if (parentId === null) {
    return [...rest, moved];
  }
  return rest.map((task) =>
    task.id === parentId
      ? { ...task, subtasks: [...(task.subtasks ?? []), moved] }
      : task,
  );
}

function subtasksInOrder(tasks: CreatedTask[]): CreatedTask[] {
  return tasks.map((task) =>
    task.subtasks
      ? {
          ...task,
          subtasks: [...task.subtasks].sort(
            (left, right) => left.sortOrder - right.sortOrder,
          ),
        }
      : task,
  );
}

function holdsTask(tasks: CreatedTask[], taskId: number): boolean {
  return tasks.some(
    (task) =>
      task.id === taskId || holdsTask(task.subtasks ?? [], taskId),
  );
}

export function useTaskActions(
  onManualOrder?: (changes: Partial<ViewPreference>) => void,
) {
  const queryClient = useQueryClient();

  function eachCachedList(
    change: (tasks: CreatedTask[]) => CreatedTask[],
  ): void {
    queryClient.setQueriesData(
      { queryKey: [TASKS_KEY] },
      (cached: unknown) =>
        looksLikeTasks(cached) ? change(cached) : cached,
    );
  }

  function committed(taskId: number): CreatedTask | undefined {
    for (const [, cached] of queryClient.getQueriesData({
      queryKey: [TASKS_KEY],
    })) {
      if (!looksLikeTasks(cached)) {
        continue;
      }
      const found = findTask(cached, taskId);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  function landed(written: CreatedTask[]): void {
    for (const task of written) {
      eachCachedList((tasks) =>
        patched({ tasks: tasks, id: task.id, changes: task }),
      );
    }
  }

  function takeBack(ids: number[]): void {
    eachCachedList((tasks) => without(tasks, ids));
  }

  function settleInPlace({
    taskId,
    parentId,
  }: {
    taskId: number;
    parentId: number | null;
  }): void {
    eachCachedList((tasks) =>
      subtasksInOrder(
        relocated({
          tasks: tasks,
          taskId: taskId,
          parentId: parentId,
        }),
      ),
    );
  }

  function addToLedger(task: CreatedTask): void {
    eachCachedList((tasks) => {
      if (holdsTask(tasks, task.id)) {
        return tasks;
      }
      if (task.parentId === null) {
        return [...tasks, task];
      }
      return tasks.map((held) =>
        held.id === task.parentId
          ? { ...held, subtasks: [...(held.subtasks ?? []), task] }
          : held,
      );
    });
  }

  function report(doing: string) {
    return (error: unknown) =>
      recordFailure({ doing: doing, error: error });
  }

  function someList(): string {
    const known = queryClient.getQueryData<string[]>(["lists"]) ?? [];
    const remembered = lastUsedList();
    return remembered && known.includes(remembered)
      ? remembered
      : (known[0] ?? "");
  }

  function everyTaskInListIsStaged(list: string): boolean {
    const wanted = canonicalName(list);
    const inList: CreatedTask[] = [];
    for (const [, cached] of queryClient.getQueriesData({
      queryKey: [TASKS_KEY],
    })) {
      if (!looksLikeTasks(cached)) {
        continue;
      }
      for (const task of cached) {
        if (
          task.parentId === null &&
          canonicalName(task.list) === wanted
        ) {
          inList.push(task);
        }
      }
    }
    return (
      inList.length > 0 && inList.every((task) => task.stage !== null)
    );
  }

  async function create(
    changes: Partial<Task>,
  ): Promise<CreatedTask> {
    const list = changes.list || someList();
    const staged =
      changes.parentId == null && everyTaskInListIsStaged(list);
    const written = {
      ...changes,
      title: changes.title ?? "",
      list: list,
      stage: changes.stage ?? (staged ? "to_do" : null),
    };
    const provisional = provisionalTask(written);
    addToLedger(provisional);

    try {
      const task = await api.createTask(written);
      takeBack([provisional.id]);
      rememberList(task.list);
      addToLedger(task);
      record({ edits: [{ before: null, after: task }] });
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      return task;
    } catch (error) {
      takeBack([provisional.id]);
      recordFailure({ doing: "add that task", error: error });
      throw error;
    }
  }

  const remove = useMutation({
    mutationFn: (task: CreatedTask) => api.deleteTask(task.id),
    onSuccess: ({ removed }, task: CreatedTask) => {
      takeBack(removed);
      record({ edits: [{ before: task, after: null }] });
    },
    onError: report("delete that task"),
  });

  const archive = useMutation({
    mutationFn: (task: CreatedTask): Promise<CreatedTask[]> =>
      api.archiveTasks([task.id]),
    onSuccess: (written: CreatedTask[], task: CreatedTask) => {
      landed(written);
      record({
        edits: [
          {
            before: task,
            after:
              written.find((held) => held.id === task.id) ?? null,
          },
        ],
      });
    },
    onError: report("archive that task"),
  });

  const moveOn = useMutation({
    mutationFn: (task: CreatedTask): Promise<CreatedTask[]> =>
      task.state === "archived"
        ? api.unarchiveTasks([task.id])
        : api.deferTask(task.id),
    onSuccess: (written: CreatedTask[], task: CreatedTask) => {
      landed(written);
      record({
        edits: [
          {
            before: task,
            after:
              written.find((held) => held.id === task.id) ?? null,
          },
        ],
      });
    },
    onError: report("move that task on"),
  });

  function rename(task: CreatedTask, changes: Partial<Task>): void {
    const before = committed(task.id) ?? task;
    defer({
      edited: [
        { before: before, showing: withChanges(before, changes) },
      ],
      call: async () => {
        const written = await api.updateTask(task.id, changes);
        landed([written]);
        return [written];
      },
      delay: NO_DELAY,
      doing: "save that edit",
      coalescing: true,
    });
  }

  function toggle(task: CreatedTask): void {
    const before = committed(task.id) ?? task;
    const shown = pendingFor(task.id) ?? before;
    const next: TaskState = isTerminal(shown.state)
      ? "to_do"
      : "complete";
    const stage: TaskStage | null =
      shown.stage === null
        ? null
        : next === "complete"
          ? "complete"
          : "to_do";
    defer({
      edited: [
        {
          before: before,
          showing: { ...shown, state: next, stage: stage },
        },
      ],
      call: async () => {
        const written = await api.setState(task.id, next);
        for (const task of written) {
          addToLedger(task);
        }
        landed(written);
        if (before.recurringTaskId !== null && !isTerminal(next)) {
          void queryClient.invalidateQueries({
            queryKey: [TASKS_KEY],
          });
        }
        return written;
      },
      delay: HOLD_MILLISECONDS,
      doing: "tick that off",
    });
  }

  function reparent(
    task: CreatedTask,
    parentId: number | null,
    orderedIds: number[] = [],
  ): void {
    const parent =
      parentId === null ? undefined : committed(parentId);
    const conferred: Partial<Task> =
      parent === undefined
        ? { parentId: parentId }
        : {
            parentId: parentId,
            list: parent.list,
            tags: parent.tags,
            who: parent.who,
            stage: parent.stage,
            dueDate: parent.dueDate,
            dueTime: parent.dueTime,
            recurringTaskId: parent.recurringTaskId,
          };

    const moving = committed(task.id) ?? task;
    const held = (orderedIds.length > 0 ? orderedIds : [task.id])
      .map((id) => committed(id))
      .filter(
        (sibling): sibling is CreatedTask => sibling !== undefined,
      );
    const slots = reassignSlots(
      held.map((sibling) => sibling.sortOrder),
    );

    defer({
      edited: held.map((sibling, index) => ({
        before: sibling,
        showing: withChanges(sibling, {
          ...(sibling.id === task.id ? conferred : {}),
          sortOrder: slots[index] ?? sibling.sortOrder,
        }),
      })),
      call: async () => {
        const written = await api.reparentTask(task.id, parentId);
        if (orderedIds.length > 1) {
          written.push(...(await api.reorderTasks(orderedIds)));
        }
        landed(written);
        settleInPlace({ taskId: moving.id, parentId: parentId });
        return written;
      },
      delay: DEBOUNCED_MILLISECONDS,
      doing:
        parentId === null
          ? "make that a task of its own"
          : "move that task under another",
    });
  }

  function move(
    taskId: number,
    destination: Attribute[],
    orderedIds: number[],
  ): void {
    onManualOrder?.({ orderBy: "manual", orderDirection: "asc" });

    const changes = asChanges(destination);
    const leavingAParent = committed(taskId)?.parentId != null;
    const freed: Partial<Task> = { parentId: null };
    const held = orderedIds
      .map((id) => committed(id))
      .filter((task): task is CreatedTask => task !== undefined);
    if (held.length !== orderedIds.length) {
      return;
    }
    const slots = reassignSlots(held.map((task) => task.sortOrder));

    defer({
      edited: held.map((task, index) => ({
        before: task,
        showing: withChanges(task, {
          ...(task.id === taskId ? { ...changes, ...freed } : {}),
          sortOrder: slots[index] ?? task.sortOrder,
        }),
      })),
      call: async () => {
        const written: CreatedTask[] = [];
        if (leavingAParent) {
          written.push(...(await api.reparentTask(taskId, null)));
        }
        if (changes.stage !== undefined) {
          written.push(
            ...(await api.setState(
              taskId,
              changes.stage === "complete" ? "complete" : "to_do",
            )),
          );
        }
        written.push(
          await api.updateTask(taskId, { ...changes, ...freed }),
        );
        if (orderedIds.length > 1) {
          written.push(...(await api.reorderTasks(orderedIds)));
        }
        landed(written);
        settleInPlace({ taskId: taskId, parentId: null });
        return written;
      },
      delay: DEBOUNCED_MILLISECONDS,
      doing: "move that task",
    });
  }

  return {
    undo: async () => {
      if (cancelNewest()) {
        return;
      }
      if (await undoLast()) {
        void queryClient.invalidateQueries();
      }
    },
    redo: async () => {
      if (await redoLast()) {
        void queryClient.invalidateQueries();
      }
    },
    toggle: toggle,
    rename: rename,
    create: create,
    remove: (task: CreatedTask) => remove.mutate(task),
    delete: (task: CreatedTask) => remove.mutate(task),
    archive: (task: CreatedTask) => archive.mutate(task),
    moveOn: (task: CreatedTask) => moveOn.mutate(task),
    toggleToday: (task: CreatedTask) =>
      rename(task, {
        dueDate: isDueToday(task.dueDate)
          ? null
          : todayAsDateString(),
      }),
    move: move,
    reparent: reparent,
  };
}
