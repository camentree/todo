import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { dateKey } from "@shared/format.ts";
import type { Comment, Definition, JournalEntry, Task } from "@shared/model.ts";

import { ApiError, get, post, put, remove } from "./api.ts";

export interface Memory {
  definitions: Definition[];
  tasks: Task[];
  comments: Comment[];
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
  putDefinition: (definition: Definition) => void;
  deleteDefinition: (id: string) => void;
  putComment: (comment: Comment) => void;
  deleteComment: (id: string) => void;
  putEntry: (write: { name: JournalName; entry: JournalEntry }) => void;
  deleteEntry: (write: { name: JournalName; id: string }) => void;
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

async function load(): Promise<Memory> {
  const [definitions, tasks, comments, journal, notebook] = await Promise.all([
    get<Definition[]>("/api/definitions"),
    get<Task[]>("/api/tasks"),
    get<Comment[]>("/api/comments"),
    get<JournalEntry[]>("/api/journal/journal"),
    get<JournalEntry[]>("/api/journal/notebook"),
  ]);
  return { definitions, tasks, comments, journal, notebook };
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
      <button className="error-sprite" onClick={start}>
        {error}
      </button>
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
      .then((tasks) => update((current) => ({ ...current, tasks })))
      .catch(() => null);

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
        request: () => remove(`/api/tasks/${id}`),
      });
    },
    putDefinition: (definition) => {
      const previous = latest.current?.definitions.find((each) => each.id === definition.id);
      write({
        apply: (current) => ({ ...current, definitions: replaced({ list: current.definitions, item: definition }) }),
        undo: (current) => ({ ...current, definitions: restored({ list: current.definitions, id: definition.id, previous }) }),
        request: () =>
          (previous ? put({ path: `/api/definitions/${definition.id}`, body: definition }) : post({ path: "/api/definitions", body: definition })).then(refreshTasks),
      });
    },
    deleteDefinition: (id) => {
      const previous = latest.current?.definitions.find((each) => each.id === id);
      write({
        apply: (current) => ({
          ...current,
          definitions: without({ list: current.definitions, id }),
          tasks: current.tasks.filter((task) => !(task.definitionId === id && task.date !== null && task.date >= today)),
        }),
        undo: (current) => ({ ...current, definitions: restored({ list: current.definitions, id, previous }) }),
        request: () => remove(`/api/definitions/${id}`).then(refreshTasks),
      });
    },
    putComment: (comment) => {
      const previous = latest.current?.comments.find((each) => each.id === comment.id);
      write({
        apply: (current) => ({ ...current, comments: replaced({ list: current.comments, item: comment }) }),
        undo: (current) => ({ ...current, comments: restored({ list: current.comments, id: comment.id, previous }) }),
        request: () => (previous ? put({ path: `/api/comments/${comment.id}`, body: comment }) : post({ path: "/api/comments", body: comment })),
      });
    },
    deleteComment: (id) => {
      const previous = latest.current?.comments.find((each) => each.id === id);
      write({
        apply: (current) => ({ ...current, comments: without({ list: current.comments, id }) }),
        undo: (current) => ({ ...current, comments: restored({ list: current.comments, id, previous }) }),
        request: () => remove(`/api/comments/${id}`),
      });
    },
    putEntry: ({ name, entry }) => {
      const previous = latest.current?.[name].find((each) => each.id === entry.id);
      write({
        apply: (current) => ({ ...current, [name]: replaced({ list: current[name], item: entry }) }),
        undo: (current) => ({ ...current, [name]: restored({ list: current[name], id: entry.id, previous }) }),
        request: () => (previous ? put({ path: `/api/journal/${name}/${entry.id}`, body: entry }) : post({ path: `/api/journal/${name}`, body: entry })),
      });
    },
    deleteEntry: ({ name, id }) => {
      const previous = latest.current?.[name].find((each) => each.id === id);
      write({
        apply: (current) => ({ ...current, [name]: without({ list: current[name], id }) }),
        undo: (current) => ({ ...current, [name]: restored({ list: current[name], id, previous }) }),
        request: () => remove(`/api/journal/${name}/${id}`),
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
