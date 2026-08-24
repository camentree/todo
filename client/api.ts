import type { TaskState } from "@shared/states.ts";
import type {
  Comment,
  CreatedTask,
  Event,
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

export const api = {
  lists: () => request<string[]>("/lists"),
  stages: () => request<string[]>("/stages"),
  tags: (list?: string) =>
    request<string[]>(
      `/tags${list ? `?list=${encodeURIComponent(list)}` : ""}`,
    ),
  knownWho: (list?: string) =>
    request<string[]>(
      `/who${list ? `?list=${encodeURIComponent(list)}` : ""}`,
    ),

  tasks: (since: string | null) =>
    request<CreatedTask[]>(
      `/tasks${since === null ? "" : `?since=${since}`}`,
    ),
  task: (id: number) => request<CreatedTask>(`/tasks/${id}`),

  createTask: (
    body: Partial<Task> & { list: string; title: string },
  ) => send<CreatedTask>("/tasks", "POST", body),
  updateTask: (id: number, body: Partial<Task>) =>
    send<CreatedTask>(`/tasks/${id}`, "PATCH", body),
  setState: (id: number, state: TaskState) =>
    send<CreatedTask>(`/tasks/${id}/state`, "POST", { state: state }),
  deleteTask: (id: number) =>
    request<{ removed: number[] }>(`/tasks/${id}`, {
      method: "DELETE",
    }),

  hideTask: (id: number) =>
    send<CreatedTask[]>(`/tasks/${id}/hide`, "POST", {}),
  unhideTask: (id: number) =>
    send<CreatedTask[]>(`/tasks/${id}/unhide`, "POST", {}),
  deferTask: (id: number) =>
    send<CreatedTask[]>(`/tasks/${id}/defer`, "POST", {}),

  comments: (taskId: number) =>
    request<Comment[]>(`/tasks/${taskId}/comments`),
  addComment: (taskId: number, body: string) =>
    send<Comment>(`/tasks/${taskId}/comments`, "POST", {
      body: body,
    }),
  resurfaceComment: (commentId: number) =>
    send<{ ok: true }>(
      `/comments/${commentId}/resurface`,
      "POST",
      {},
    ),
  deleteComment: (commentId: number) =>
    send<{ ok: true }>(`/comments/${commentId}`, "DELETE", {}),
  archiveTasks: (ids: number[]) =>
    send<CreatedTask[]>("/tasks/archive", "POST", { ids: ids }),
  unarchiveTasks: (ids: number[]) =>
    send<CreatedTask[]>("/tasks/unarchive", "POST", { ids: ids }),
  reorderTasks: (ids: number[]) =>
    send<CreatedTask[]>("/tasks/reorder", "POST", { ids: ids }),

  unseenEvents: () => request<Event[]>("/events/unseen"),
  markEventsSeen: () =>
    send<{ ok: true }>("/events/seen", "POST", {}),
  markEventSeen: (id: number) =>
    send<{ ok: true }>(`/events/${id}/seen`, "POST", {}),
};
