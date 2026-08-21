import type { TaskState } from "@shared/states.ts";
import type {
  Comment,
  Event,
  Frequency,
  RecurringTask,
  Task,
} from "@shared/types.ts";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({ error: "request failed" }));
    throw new Error(body.error ?? "request failed");
  }
  return response.json() as Promise<T>;
}

function send<T>(
  path: string,
  method: string,
  body: unknown,
): Promise<T> {
  return request<T>(path, {
    method: method,
    body: JSON.stringify(body),
  });
}

export interface RecurringTaskDetail extends RecurringTask {
  subtaskTitles: string[];
}

export const api = {
  lists: () => request<string[]>("/lists"),
  stages: () => request<string[]>("/stages"),
  tags: (list?: string) =>
    request<string[]>(
      `/tags${list ? `?list=${encodeURIComponent(list)}` : ""}`,
    ),
  knownWho: () => request<string[]>("/who"),

  today: () => request<Task[]>("/today"),
  done: () => request<Task[]>("/done"),
  archive: () => request<Task[]>("/archive"),
  tasks: (params: Record<string, string>) =>
    request<Task[]>(
      `/tasks?${new URLSearchParams(params).toString()}`,
    ),
  task: (id: number) => request<Task>(`/tasks/${id}`),

  createTask: (
    body: Partial<Task> & { list: string; title: string },
  ) => send<Task>("/tasks", "POST", body),
  updateTask: (id: number, body: Partial<Task>) =>
    send<Task>(`/tasks/${id}`, "PATCH", body),
  setState: (id: number, state: TaskState) =>
    send<Task>(`/tasks/${id}/state`, "POST", { state: state }),

  hideTask: (id: number) =>
    send<{ ok: true }>(`/tasks/${id}/hide`, "POST", {}),
  unhideTask: (id: number) =>
    send<{ ok: true }>(`/tasks/${id}/unhide`, "POST", {}),
  deferTask: (id: number) =>
    send<{ ok: true }>(`/tasks/${id}/defer`, "POST", {}),

  comments: (taskId: number) =>
    request<Comment[]>(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) =>
    send<Comment>(`/tasks/${taskId}/comments`, "POST", {
      body: body,
    }),
  markCommentsSeen: (taskId: number) =>
    send<{ ok: true }>(`/tasks/${taskId}/comments/seen`, "POST", {}),
  archiveTasks: (ids: number[]) =>
    send<{ ok: true }>("/tasks/archive", "POST", { ids: ids }),
  unarchiveTasks: (ids: number[]) =>
    send<{ ok: true }>("/tasks/unarchive", "POST", { ids: ids }),
  reorderTasks: (ids: number[]) =>
    send<{ ok: true }>("/tasks/reorder", "POST", { ids: ids }),

  recurringTask: (id: number) =>
    request<RecurringTaskDetail>(`/recurring/${id}`),
  createRecurring: (body: Record<string, unknown>) =>
    send<RecurringTaskDetail>("/recurring", "POST", body),
  pauseRecurring: (id: number, paused: boolean) =>
    send<{ ok: true }>(`/recurring/${id}/pause`, "POST", {
      paused: paused,
    }),
  repeatTask: (taskId: number, frequency: Frequency) =>
    send<RecurringTaskDetail>(`/tasks/${taskId}/repeat`, "POST", {
      frequency: frequency,
    }),
  configureRecurring: (
    id: number,
    changes: {
      frequency?: Frequency;
      repeatEvery?: number;
      weekdays?: number[];
      startsOn?: string;
      dueTime?: string | null;
    },
  ) =>
    send<RecurringTaskDetail>(
      `/recurring/${id}/schedule`,
      "POST",
      changes,
    ),

  unseenEvents: () => request<Event[]>("/events/unseen"),
  markEventsSeen: () =>
    send<{ ok: true }>("/events/seen", "POST", {}),
  markEventSeen: (id: number) =>
    send<{ ok: true }>(`/events/${id}/seen`, "POST", {}),
};
