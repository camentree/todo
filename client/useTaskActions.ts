import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { api } from "./api.ts";
import { recordFailure } from "./failures.ts";
import {
  recordArchiving,
  recordDeferral,
  recordDeletion,
  recordEdit,
  recordHiding,
  recordStateChange,
  redo as redoLast,
  undo as undoLast,
} from "./history.ts";
import { isDueToday } from "./format.ts";
import type { Landing } from "./components/TaskBoard.tsx";
import { reassignSlots } from "@shared/ordering.ts";
import {
  dueDateIn,
  dueTimeIn,
  listIn,
  parse,
  recurrenceIn,
  stageIn,
  stateIn,
  tagsIn,
  whoIn,
} from "@shared/parser.ts";
import { toDateString } from "@shared/recurrence.ts";
import { isTerminal, type TaskState } from "@shared/states.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

const HOLD_MILLISECONDS = 2000;
const FLUSH_MILLISECONDS = 500;
const LAST_LIST_KEY = "todo.lastList";

function rememberList(list: string): void {
  window.localStorage.setItem(LAST_LIST_KEY, list);
}

function lastUsedList(): string | null {
  return window.localStorage.getItem(LAST_LIST_KEY);
}

type SwipeRightOutcome =
  "deleted" | "unhidden" | "deferred" | "hidden";

function recordSwipeRight({
  task,
  outcome,
}: {
  task: CreatedTask;
  outcome: SwipeRightOutcome;
}): void {
  if (outcome === "deleted") {
    recordDeletion(task);
    return;
  }
  if (outcome === "deferred") {
    recordDeferral(task);
    return;
  }
  recordHiding({ task: task, hiding: outcome === "hidden" });
}

interface QueuedMove {
  taskId: number;
  landing: Landing;
  orderedIds: number[];
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
      subtasks:
        changes.state === "complete" && subtasks
          ? subtasks.map((subtask) => ({
              ...subtask,
              state: "complete" as TaskState,
            }))
          : subtasks,
    };
  });
}

export function taskAsLine(task: CreatedTask): string {
  return [
    task.title,
    ...task.tags.map((tag) => `#${tag}`),
    task.who ? `@${task.who}` : "",
    `/${task.list}`,
    task.stage ? `!${task.stage}` : "",
    task.dueDate ?? "",
    task.dueTime ? task.dueTime.slice(0, 5) : "",
  ]
    .filter((part) => part)
    .join(" ");
}

export function renameChanges(input: string): Partial<Task> {
  const parsed = parse({ input: input, today: new Date() });

  const tags = tagsIn(parsed.tokens);
  const who = whoIn(parsed.tokens);
  const list = listIn(parsed.tokens);
  const stage = stageIn(parsed.tokens);
  const state = stateIn(parsed.tokens);
  const dueDate = dueDateIn(parsed.tokens);
  const dueTime = dueTimeIn(parsed.tokens);
  const recurrence = recurrenceIn(parsed.tokens);
  const startsOn = dueDate ?? toDateString(new Date());

  return {
    title: parsed.title,
    ...(recurrence
      ? {
          schedule: { ...recurrence, startsOn: startsOn },
          dueDate: startsOn,
        }
      : {}),
    ...(tags.length > 0
      ? { tags: tags.filter((tag) => tag.length > 0) }
      : {}),
    ...(who === null ? {} : { who: who === "" ? null : who }),
    ...(list ? { list: list } : {}),
    ...(stage === null ? {} : { stage: stage === "" ? null : stage }),
    ...(state === null || state === "archived"
      ? {}
      : { state: state }),
    ...(state === "archived"
      ? { archivedAt: new Date().toISOString() }
      : {}),
    ...(dueDate ? { dueDate: dueDate } : {}),
    ...(dueTime ? { dueTime: dueTime } : {}),
  };
}

export function useTaskActions(
  onManualOrder?: (changes: Partial<ViewPreference>) => void,
) {
  const queryClient = useQueryClient();
  const [justToggled, setJustToggled] = useState<
    Map<number, TaskState>
  >(new Map());
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingMoves = useRef<QueuedMove[]>([]);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  function patchEverywhere(id: number, changes: Partial<Task>): void {
    queryClient.setQueriesData({ queryKey: [] }, (cached: unknown) =>
      looksLikeTasks(cached)
        ? patched({ tasks: cached, id: id, changes: changes })
        : cached,
    );
  }

  function takeBack(ids: number[]): void {
    queryClient.setQueriesData({ queryKey: [] }, (cached: unknown) =>
      looksLikeTasks(cached)
        ? cached.filter((task) => !ids.includes(task.id))
        : cached,
    );
  }

  function addToLedger(task: CreatedTask): void {
    queryClient.setQueriesData({ queryKey: [] }, (cached: unknown) =>
      looksLikeTasks(cached) &&
      !cached.some((held) => held.id === task.id)
        ? [...cached, task]
        : cached,
    );
  }

  function landed(written: CreatedTask[]): void {
    for (const task of written) {
      patchEverywhere(task.id, task);
    }
  }

  function report(doing: string) {
    return (error: unknown) =>
      recordFailure({ doing: doing, error: error });
  }

  function toggleState(task: CreatedTask): void {
    const showing = justToggled.get(task.id) ?? task.state;
    const next: TaskState = isTerminal(showing)
      ? "to_do"
      : "complete";

    const running = timers.current.get(task.id);
    if (running) {
      clearTimeout(running);
    }
    const written = api.setState(task.id, next).then(
      (updated: CreatedTask) => ({ updated: updated, error: null }),
      (error: unknown) => ({ updated: null, error: error }),
    );

    setJustToggled((current) => new Map(current).set(task.id, next));
    timers.current.set(
      task.id,
      setTimeout(() => {
        timers.current.delete(task.id);
        void written.then(({ updated, error }) => {
          setJustToggled((current) => {
            const settled = new Map(current);
            settled.delete(task.id);
            return settled;
          });
          if (updated) {
            patchEverywhere(updated.id, updated);
            recordStateChange({ task: task, next: next });
            return;
          }
          report("tick that off")(error);
        });
      }, HOLD_MILLISECONDS),
    );
  }

  function someList(): string {
    const known = queryClient.getQueryData<string[]>(["lists"]) ?? [];
    const remembered = lastUsedList();
    return remembered && known.includes(remembered)
      ? remembered
      : (known[0] ?? "");
  }

  const create = useMutation({
    mutationFn: (changes: Partial<Task>) =>
      api.createTask({
        ...changes,
        title: changes.title ?? "",
        list: changes.list || someList(),
      }),
    onSuccess: (task: CreatedTask) => {
      rememberList(task.list);
      addToLedger(task);
    },
    onError: report("add that task"),
  });

  const rename = useMutation({
    mutationFn: ({
      task,
      changes,
    }: {
      task: CreatedTask;
      changes: Partial<Task>;
    }) => api.updateTask(task.id, changes),
    onMutate: ({ task, changes }) => {
      recordEdit({ task: task, changes: changes });
      patchEverywhere(task.id, changes);
    },
    onSuccess: (written: CreatedTask) =>
      patchEverywhere(written.id, written),
    onError: (error: unknown, { task }) => {
      patchEverywhere(task.id, task);
      report("save that edit")(error);
    },
  });

  const remove = useMutation({
    mutationFn: (task: CreatedTask) => api.deleteTask(task.id),
    onSuccess: ({ removed }, task: CreatedTask) => {
      takeBack(removed);
      recordDeletion(task);
    },
    onError: report("delete that task"),
  });

  const swipeLeft = useMutation({
    mutationFn: (task: CreatedTask) =>
      task.archivedAt
        ? api.unarchiveTasks([task.id])
        : api.archiveTasks([task.id]),
    onSuccess: (written: CreatedTask[], task: CreatedTask) => {
      landed(written);
      recordArchiving({
        task: task,
        archiving: task.archivedAt === null,
      });
    },
    onError: report("archive that task"),
  });

  const swipeRight = useMutation({
    mutationFn: async (
      task: CreatedTask,
    ): Promise<{
      outcome: SwipeRightOutcome;
      written: CreatedTask[];
    }> => {
      if (task.archivedAt) {
        const { removed } = await api.deleteTask(task.id);
        takeBack(removed);
        return { outcome: "deleted", written: [] };
      }
      if (task.state === "hidden") {
        return {
          outcome: "unhidden",
          written: await api.unhideTask(task.id),
        };
      }
      if (task.recurringTaskId || isDueToday(task.dueDate)) {
        return {
          outcome: "deferred",
          written: await api.deferTask(task.id),
        };
      }
      return {
        outcome: "hidden",
        written: await api.hideTask(task.id),
      };
    },
    onSuccess: ({ outcome, written }, task: CreatedTask) => {
      landed(written);
      recordSwipeRight({ task: task, outcome: outcome });
    },
    onError: report("put that task away"),
  });

  function reorderInMemory(orderedIds: number[]): void {
    queryClient.setQueriesData(
      { queryKey: [] },
      (cached: unknown) => {
        if (!looksLikeTasks(cached)) {
          return cached;
        }
        const held = orderedIds
          .map((id) => cached.find((task) => task.id === id))
          .filter((task): task is CreatedTask => task !== undefined);
        if (held.length !== orderedIds.length) {
          return cached;
        }
        const slots = reassignSlots(
          held.map((task) => task.sortOrder),
        );
        const moved = new Map(
          orderedIds.map((id, index) => [id, slots[index] ?? 0]),
        );
        return cached.map((task) =>
          moved.has(task.id)
            ? {
                ...task,
                sortOrder: moved.get(task.id) ?? task.sortOrder,
              }
            : task,
        );
      },
    );
  }

  function flushMoves(): void {
    const queued = [...pendingMoves.current];
    pendingMoves.current = [];

    void (async () => {
      for (const { taskId, landing, orderedIds } of queued) {
        if (landing.stage !== undefined) {
          landed([
            await api.setState(
              taskId,
              landing.stage === "complete" ? "complete" : "to_do",
            ),
          ]);
        }
        if (
          landing.list !== undefined ||
          landing.stage !== undefined
        ) {
          landed([
            await api.updateTask(taskId, {
              list: landing.list,
              stage: landing.stage,
            }),
          ]);
        }
        if (orderedIds.length > 1) {
          landed(await api.reorderTasks(orderedIds));
        }
      }
    })().catch(report("move that task"));
  }

  function move(
    taskId: number,
    landing: Landing,
    orderedIds: number[],
  ): void {
    if (landing.list !== undefined || landing.stage !== undefined) {
      patchEverywhere(taskId, {
        list: landing.list,
        stage: landing.stage,
        state: landing.stage === "complete" ? "complete" : undefined,
      });
    }
    reorderInMemory(orderedIds);

    pendingMoves.current.push({
      taskId: taskId,
      landing: landing,
      orderedIds: orderedIds,
    });
    if (moveTimer.current) {
      clearTimeout(moveTimer.current);
    }
    moveTimer.current = setTimeout(flushMoves, FLUSH_MILLISECONDS);
  }

  return {
    justToggled: justToggled,
    undo: async () => {
      if (await undoLast()) {
        void queryClient.invalidateQueries();
      }
    },
    redo: async () => {
      if (await redoLast()) {
        void queryClient.invalidateQueries();
      }
    },
    toggleTask: toggleState,
    rename: (task: CreatedTask, changes: Partial<Task>) =>
      rename.mutate({ task: task, changes: changes }),
    create: (changes: Partial<Task>) => create.mutateAsync(changes),
    remove: (task: CreatedTask) => remove.mutate(task),
    swipeLeft: (task: CreatedTask) => swipeLeft.mutate(task),
    swipeRight: (task: CreatedTask) => swipeRight.mutate(task),
    move: (
      taskId: number,
      landing: Landing,
      orderedIds: number[],
    ) => {
      onManualOrder?.({ orderBy: "manual", orderDirection: "asc" });
      move(taskId, landing, orderedIds);
    },
  };
}
