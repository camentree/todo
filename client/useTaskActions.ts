import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { api } from "./api.ts";
import { isDueToday } from "./format.ts";
import type { Landing } from "./components/TaskBoard.tsx";
import { reassignSlots } from "@shared/ordering.ts";
import {
  listIn,
  parse,
  stageIn,
  tagsIn,
  whoIn,
} from "@shared/parser.ts";
import { isTerminal, type TaskState } from "@shared/states.ts";
import type { Task, ViewPreference } from "@shared/types.ts";

const SETTLE_MILLISECONDS = 600;
const FLUSH_MILLISECONDS = 500;

interface QueuedMove {
  taskId: number;
  landing: Landing;
  orderedIds: number[];
}

function looksLikeTasks(value: unknown): value is Task[] {
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
  tasks: Task[];
  id: number;
  changes: Partial<Task>;
}): Task[] {
  return tasks.map((task) => {
    const subtasks = task.subtasks
      ? patched({ tasks: task.subtasks, id: id, changes: changes })
      : task.subtasks;

    if (task.id !== id) {
      return { ...task, subtasks: subtasks };
    }

    return {
      ...task,
      ...changes,
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

const GUESSED_KINDS = new Set(["dueDate", "dueTime", "recurrence"]);

function renameChanges(task: Task, input: string): Partial<Task> {
  const guessed = parse({
    input: input,
    today: new Date(),
    dismissed: [],
  }).tokens.filter((token) => GUESSED_KINDS.has(token.kind));

  const parsed = parse({
    input: input,
    today: new Date(),
    dismissed: guessed.map((token) => token.text),
  });

  const tags = tagsIn(parsed.tokens);
  const who = whoIn(parsed.tokens);
  const list = listIn(parsed.tokens);
  const stage = stageIn(parsed.tokens);

  return {
    title: parsed.title,
    ...(tags.length > 0
      ? { tags: [...new Set([...task.tags, ...tags])] }
      : {}),
    ...(who ? { who: who } : {}),
    ...(list ? { list: list } : {}),
    ...(stage ? { stage: stage } : {}),
  };
}

export function useTaskActions(
  onManualOrder?: (changes: Partial<ViewPreference>) => void,
) {
  const queryClient = useQueryClient();
  const [settling, setSettling] = useState<Set<number>>(new Set());
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );
  const pendingMoves = useRef<QueuedMove[]>([]);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const refresh = () => queryClient.invalidateQueries();

  function patchEverywhere(id: number, changes: Partial<Task>): void {
    queryClient.setQueriesData({ queryKey: [] }, (cached: unknown) =>
      looksLikeTasks(cached)
        ? patched({ tasks: cached, id: id, changes: changes })
        : cached,
    );
  }

  function holdInPlace(id: number): void {
    const existing = timers.current.get(id);
    if (existing) {
      clearTimeout(existing);
    }
    setSettling((current) => new Set(current).add(id));
    timers.current.set(
      id,
      setTimeout(() => {
        setSettling((current) => {
          const next = new Set(current);
          next.delete(id);
          return next;
        });
        timers.current.delete(id);
      }, SETTLE_MILLISECONDS),
    );
  }

  const setState = useMutation({
    mutationFn: (task: Task) =>
      api.setState(
        task.id,
        isTerminal(task.state) ? "to_do" : "complete",
      ),
    onMutate: async (task: Task) => {
      const next = isTerminal(task.state) ? "to_do" : "complete";
      patchEverywhere(task.id, { state: next });
      if (next === "complete" && task.parentId === null) {
        holdInPlace(task.id);
      }
    },
    onSettled: refresh,
  });

  const rename = useMutation({
    mutationFn: ({ task, title }: { task: Task; title: string }) =>
      api.updateTask(task.id, renameChanges(task, title)),
    onMutate: ({ task, title }) => {
      patchEverywhere(task.id, renameChanges(task, title));
    },
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (task: Task) => api.deleteTask(task.id),
    onSuccess: refresh,
  });

  const swipeLeft = useMutation({
    mutationFn: (task: Task) =>
      task.archivedAt
        ? api.unarchiveTasks([task.id])
        : api.archiveTasks([task.id]),
    onSuccess: refresh,
  });

  const swipeRight = useMutation({
    mutationFn: (task: Task) => {
      if (task.archivedAt) {
        return api.deleteTask(task.id);
      }
      if (task.state === "hidden") {
        return api.unhideTask(task.id);
      }
      return task.recurringTaskId || isDueToday(task.dueDate)
        ? api.deferTask(task.id)
        : api.hideTask(task.id);
    },
    onSuccess: refresh,
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
          .filter((task): task is Task => task !== undefined);
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
          await api.setState(
            taskId,
            landing.stage === "complete" ? "complete" : "to_do",
          );
        }
        if (
          landing.list !== undefined ||
          landing.stage !== undefined
        ) {
          await api.updateTask(taskId, {
            list: landing.list,
            stage: landing.stage,
          });
        }
        if (orderedIds.length > 1) {
          await api.reorderTasks(orderedIds);
        }
      }
      refresh();
    })();
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
    settling: settling,
    toggleTask: (task: Task) => setState.mutate(task),
    rename: (task: Task, title: string) =>
      rename.mutate({ task: task, title: title }),
    remove: (task: Task) => remove.mutate(task),
    swipeLeft: (task: Task) => swipeLeft.mutate(task),
    swipeRight: (task: Task) => swipeRight.mutate(task),
    move: (
      taskId: number,
      landing: Landing,
      orderedIds: number[],
    ) => {
      onManualOrder?.({ sortBy: "manual", sortDirection: "asc" });
      move(taskId, landing, orderedIds);
    },
  };
}
