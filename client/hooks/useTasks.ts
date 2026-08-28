import { useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "../data/api.ts";
import {
  historyStartsOn,
  useSettledHistory,
} from "../data/settings.ts";
import type { CreatedTask } from "@shared/types.ts";

export const TASKS_KEY = "tasks";

export function findTask(
  tasks: CreatedTask[],
  taskId: number,
): CreatedTask | undefined {
  for (const task of tasks) {
    if (task.id === taskId) {
      return task;
    }
    const nested = findTask(task.subtasks ?? [], taskId);
    if (nested) {
      return nested;
    }
  }
  return undefined;
}

export function useTasks(): {
  tasks: CreatedTask[];
  isPending: boolean;
} {
  const since = historyStartsOn(useSettledHistory());
  const { data: tasks = [], isPending } = useQuery({
    queryKey: [TASKS_KEY, since],
    queryFn: () => api.tasks(since),
  });
  return { tasks: tasks, isPending: isPending };
}

export function useTask(taskId: number | null): {
  task: CreatedTask | undefined;
  isPending: boolean;
  isError: boolean;
} {
  const queryClient = useQueryClient();
  const { tasks, isPending: listPending } = useTasks();
  const held = taskId === null ? undefined : findTask(tasks, taskId);

  const { isPending: fetchPending, isError } = useQuery({
    queryKey: ["task", taskId],
    queryFn: async () => {
      const fetched = await api.task(taskId ?? 0);
      queryClient.setQueriesData(
        { queryKey: [TASKS_KEY] },
        (cached: unknown) =>
          Array.isArray(cached) ? [...cached, fetched] : cached,
      );
      return fetched;
    },
    enabled: taskId !== null && !listPending && held === undefined,
    retry: false,
    gcTime: 0,
  });

  return {
    task: held,
    isPending:
      taskId !== null &&
      (listPending || (held === undefined && fetchPending)),
    isError: isError,
  };
}
