import type { Comment, JournalEntry, Schedule, Task } from "@shared/model.ts";

export type JournalName = "journal" | "notebook";

export class ApiError extends Error {}

const base = import.meta.env.VITE_API_URL;

async function send({ method, path, body }: { method: string; path: string; body?: unknown }): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(new URL(path, base), {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("could not reach Parallax");
  }
  if (!response.ok) {
    const text = await response.text();
    try {
      throw new ApiError((JSON.parse(text) as { error?: string }).error ?? response.statusText);
    } catch (failure) {
      throw failure instanceof ApiError ? failure : new ApiError("could not reach Parallax");
    }
  }
  if (response.status === 204) return null;
  return response.json();
}

function get<T>(path: string): Promise<T> {
  return send({ method: "GET", path }) as Promise<T>;
}

function post({ path, body }: { path: string; body: unknown }): Promise<unknown> {
  return send({ method: "POST", path, body });
}

function put({ path, body }: { path: string; body: unknown }): Promise<unknown> {
  return send({ method: "PUT", path, body });
}

function remove(path: string): Promise<unknown> {
  return send({ method: "DELETE", path });
}

function taskFromWire(task: Task): Task {
  return {
    ...task,
    subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, subtasks: [], comments: [] })),
    comments: task.comments ?? [],
  };
}

export function listSchedules(): Promise<Schedule[]> {
  return get<Schedule[]>("schedules");
}

export function createSchedule(schedule: Schedule): Promise<unknown> {
  return post({ path: "schedules", body: schedule });
}

export function updateSchedule(schedule: Schedule): Promise<unknown> {
  return put({ path: `schedules/${schedule.id}`, body: schedule });
}

export function deleteSchedule(id: string): Promise<unknown> {
  return remove(`schedules/${id}`);
}

export function listTasks(): Promise<Task[]> {
  return get<Task[]>("tasks").then((tasks) => tasks.map(taskFromWire));
}

export function listDeletedTasks(days: number): Promise<Task[]> {
  return get<Task[]>(`tasks/recently-deleted?days=${days}`).then((tasks) => tasks.map(taskFromWire));
}

export function createTask(task: Task): Promise<unknown> {
  return post({ path: "tasks", body: task });
}

export function updateTask(task: Task): Promise<unknown> {
  return put({ path: `tasks/${task.id}`, body: task });
}

export function deleteTask(id: string): Promise<unknown> {
  return remove(`tasks/${id}`);
}

export function createComment(comment: Comment): Promise<unknown> {
  return post({ path: `tasks/${comment.taskId}/comments`, body: comment });
}

export function updateComment(comment: Comment): Promise<unknown> {
  return put({ path: `comments/${comment.id}`, body: comment });
}

export function deleteComment(id: string): Promise<unknown> {
  return remove(`comments/${id}`);
}

export function listJournals(name: JournalName): Promise<JournalEntry[]> {
  return get<JournalEntry[]>(name);
}

export function createEntry({ name, entry }: { name: JournalName; entry: JournalEntry }): Promise<unknown> {
  return post({ path: name, body: entry });
}

export function updateEntry({ name, entry }: { name: JournalName; entry: JournalEntry }): Promise<unknown> {
  return put({ path: `${name}/${encodeURIComponent(entry.at)}`, body: entry });
}

export function deleteEntry({ name, at }: { name: JournalName; at: string }): Promise<unknown> {
  return remove(`${name}/${encodeURIComponent(at)}`);
}
