import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { dateKey } from "@shared/format.ts";
import type { Comment, JournalEntry, Schedule, Task } from "@shared/model.ts";
import { deletedDays } from "@shared/tasks.ts";

import { ApiError, get, post, put, remove } from "./api.ts";

export interface Memory {
  schedules: Schedule[];
  tasks: Task[];
  deleted: Task[];
  journal: JournalEntry[];
  notebook: JournalEntry[];
}

export type JournalName = "journal" | "notebook";

export interface Store extends Memory {
  today: string;
  error: string | null;
  dismissError: () => void;
  putTask: (task: Task) => void;
  deleteTask: (id: string) => void;
  putSchedule: (schedule: Schedule) => void;
  deleteSchedule: (id: string) => void;
  putComment: (comment: Comment) => void;
  deleteComment: (id: string) => void;
  putEntry: (write: { name: JournalName; entry: JournalEntry }) => void;
  deleteEntry: (write: { name: JournalName; at: string }) => void;
}

const StoreContext = createContext<Store | null>(null);

export function identifier(): string {
  return Math.random().toString(36).slice(2, 11);
}

export function nowStamp(): string {
  const now = new Date();
  return dateKey(now) + "T" + now.toTimeString().slice(0, 8);
}

function replaced<T extends { id: string }>({ list, item }: { list: T[]; item: T }): T[] {
  return list.some((each) => each.id === item.id) ? list.map((each) => (each.id === item.id ? item : each)) : [...list, item];
}

function without<T extends { id: string }>({ list, id }: { list: T[]; id: string }): T[] {
  return list.filter((each) => each.id !== id);
}

function restored<T extends { id: string }>({ list, id, previous }: { list: T[]; id: string; previous: T | undefined }): T[] {
  if (!previous) return without({ list, id });
  return replaced({ list, item: previous });
}

function normalized(task: Task): Task {
  return {
    ...task,
    subtasks: (task.subtasks ?? []).map((subtask) => ({ ...subtask, subtasks: [], comments: [] })),
    comments: task.comments ?? [],
  };
}

const deletedPath = `/api/tasks/deleted?days=${deletedDays}`;

async function load(): Promise<Memory> {
  const [schedules, tasks, deleted, journal, notebook] = await Promise.all([
    get<Schedule[]>("/api/schedules"),
    get<Task[]>("/api/tasks"),
    get<Task[]>(deletedPath),
    get<JournalEntry[]>("/api/journal"),
    get<JournalEntry[]>("/api/notebook"),
  ]);
  return { schedules, tasks: tasks.map(normalized), deleted: deleted.map(normalized), journal, notebook };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [memory, setMemory] = useState<Memory | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => dateKey(new Date()));
  const latest = useRef<Memory | null>(null);

  const update = (change: (memory: Memory) => Memory) => {
    if (!latest.current) return;
    latest.current = change(latest.current);
    setMemory(latest.current);
  };

  const start = () =>
    load()
      .then((loaded) => {
        latest.current = loaded;
        setMemory(loaded);
        setError(null);
        setToday(dateKey(new Date()));
      })
      .catch((failure: Error) => setError(failure.message));

  useEffect(() => {
    start();
    const wake = () => {
      if (document.visibilityState === "visible" && dateKey(new Date()) !== today) start();
    };
    document.addEventListener("visibilitychange", wake);
    return () => document.removeEventListener("visibilitychange", wake);
  }, [today]);

  if (!memory) {
    return error ? (
      <div className="error-report">
        <button className="error-sprite" onClick={start}>
          error
        </button>
        <div className="error-detail">{error}</div>
      </div>
    ) : null;
  }

  const write = ({ apply, undo, request }: { apply: (memory: Memory) => Memory; undo: (memory: Memory) => Memory; request: () => Promise<unknown> }) => {
    update(apply);
    request().catch((failure: Error) => {
      update(undo);
      setError(failure instanceof ApiError ? failure.message : "could not reach Parallax");
    });
  };

  const refreshTasks = () =>
    get<Task[]>("/api/tasks")
      .then((tasks) => update((current) => ({ ...current, tasks: tasks.map(normalized) })))
      .catch(() => null);

  const refreshDeleted = () =>
    get<Task[]>(deletedPath)
      .then((deleted) => update((current) => ({ ...current, deleted: deleted.map(normalized) })))
      .catch(() => null);

  const findComment = (id: string): { task: Task; comment: Comment } | null => {
    for (const task of latest.current?.tasks ?? []) {
      const comment = task.comments.find((each) => each.id === id);
      if (comment) return { task, comment };
    }
    return null;
  };

  const store: Store = {
    ...memory,
    today,
    error,
    dismissError: () => setError(null),
    putTask: (task) => {
      const previous = latest.current?.tasks.find((each) => each.id === task.id);
      write({
        apply: (current) => ({ ...current, tasks: replaced({ list: current.tasks, item: task }) }),
        undo: (current) => ({ ...current, tasks: restored({ list: current.tasks, id: task.id, previous }) }),
        request: () => (previous ? put({ path: `/api/tasks/${task.id}`, body: task }) : post({ path: "/api/tasks", body: task })),
      });
    },
    deleteTask: (id) => {
      const previous = latest.current?.tasks.find((each) => each.id === id);
      write({
        apply: (current) => ({ ...current, tasks: without({ list: current.tasks, id }) }),
        undo: (current) => ({ ...current, tasks: restored({ list: current.tasks, id, previous }) }),
        request: () => remove(`/api/tasks/${id}`).then(refreshDeleted),
      });
    },
    putSchedule: (schedule) => {
      const previous = latest.current?.schedules.find((each) => each.id === schedule.id);
      write({
        apply: (current) => ({ ...current, schedules: replaced({ list: current.schedules, item: schedule }) }),
        undo: (current) => ({ ...current, schedules: restored({ list: current.schedules, id: schedule.id, previous }) }),
        request: () =>
          (previous ? put({ path: `/api/schedules/${schedule.id}`, body: schedule }) : post({ path: "/api/schedules", body: schedule })).then(refreshTasks),
      });
    },
    deleteSchedule: (id) => {
      const previous = latest.current?.schedules.find((each) => each.id === id);
      write({
        apply: (current) => ({
          ...current,
          schedules: without({ list: current.schedules, id }),
          tasks: current.tasks.filter((task) => !(task.scheduleId === id && task.dueDate !== null && task.dueDate >= today)),
        }),
        undo: (current) => ({ ...current, schedules: restored({ list: current.schedules, id, previous }) }),
        request: () => remove(`/api/schedules/${id}`).then(refreshTasks),
      });
    },
    putComment: (comment) => {
      const previousTasks = latest.current?.tasks ?? [];
      const existing = findComment(comment.id);
      const host = latest.current?.tasks.find((each) => each.id === comment.taskId);
      const carries = (task: Task): boolean =>
        task.comments.some((each) => each.id === comment.id) || task.id === comment.taskId || (host?.scheduleId !== null && host !== undefined && task.scheduleId === host.scheduleId);
      write({
        apply: (current) => ({
          ...current,
          tasks: current.tasks.map((task) => (carries(task) ? { ...task, comments: replaced({ list: task.comments, item: comment }) } : task)),
        }),
        undo: (current) => ({ ...current, tasks: previousTasks }),
        request: () =>
          existing ? put({ path: `/api/comments/${comment.id}`, body: comment }) : post({ path: `/api/tasks/${comment.taskId}/comments`, body: comment }),
      });
    },
    deleteComment: (id) => {
      const previousTasks = latest.current?.tasks ?? [];
      write({
        apply: (current) => ({ ...current, tasks: current.tasks.map((task) => ({ ...task, comments: without({ list: task.comments, id }) })) }),
        undo: (current) => ({ ...current, tasks: previousTasks }),
        request: () => remove(`/api/comments/${id}`),
      });
    },
    putEntry: ({ name, entry }) => {
      const previous = latest.current?.[name].find((each) => each.at === entry.at);
      const others = (current: Memory) => current[name].filter((each) => each.at !== entry.at);
      write({
        apply: (current) => ({ ...current, [name]: [...others(current), entry] }),
        undo: (current) => ({ ...current, [name]: previous ? [...others(current), previous] : others(current) }),
        request: () =>
          previous ? put({ path: `/api/${name}/${encodeURIComponent(entry.at)}`, body: entry }) : post({ path: `/api/${name}`, body: entry }),
      });
    },
    deleteEntry: ({ name, at }) => {
      const previous = latest.current?.[name].find((each) => each.at === at);
      const others = (current: Memory) => current[name].filter((each) => each.at !== at);
      write({
        apply: (current) => ({ ...current, [name]: others(current) }),
        undo: (current) => ({ ...current, [name]: previous ? [...others(current), previous] : others(current) }),
        request: () => remove(`/api/${name}/${encodeURIComponent(at)}`),
      });
    },
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
