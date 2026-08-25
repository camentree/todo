import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";

import { api } from "../api.ts";
import { recordFailure } from "../failures.ts";
import {
  recordArchiving,
  recordDeferral,
  recordDeletion,
  recordEdit,
  recordHiding,
  recordStateChange,
  redo as redoLast,
  undo as undoLast,
} from "../history.ts";
import { SearchField } from "../components/SearchField.tsx";
import { TopBar } from "../components/TopBar.tsx";
import { Shortcuts } from "../components/Shortcuts.tsx";
import { TaskBoard } from "../components/TaskBoard.tsx";
import { AddButton } from "../components/TaskRow.tsx";
import type {
  DestinationAttributes,
  HiddenAttribute,
} from "../types.ts";
import { TaskInfo } from "../components/TaskInfo.tsx";
import {
  asTitle,
  attributeText,
  isDueToday,
  todayAsDateString,
} from "../format.ts";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts.ts";
import { TASKS_KEY, useTasks } from "../hooks/useTasks.ts";
import {
  defaultView,
  SEARCH_VIEW,
  SEARCH_VIEW_KEY,
  useViewPreference,
} from "../settings.ts";
import type { Scope } from "../settings.ts";
import { reassignSlots } from "@shared/ordering.ts";
import { asAttribute } from "@shared/attributes.ts";
import { canonicalName } from "@shared/names.ts";
import { asStage } from "@shared/stages.ts";
import { isTerminal, type TaskState } from "@shared/states.ts";
import { searchTasks } from "@shared/search.ts";
import type {
  CreatedTask,
  Task,
  ViewPreference,
} from "@shared/types.ts";

export function TasksScreen() {
  const parameters = useParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openTaskId = parameters.taskId
    ? Number(parameters.taskId)
    : null;
  const segments = location.pathname.split("/").filter(Boolean);
  const screen =
    openTaskId === null ? segments : segments.slice(0, -1);
  const pathname = `/${screen.join("/")}`;
  const [field, value] = screen;

  const scope: Scope =
    pathname === "/today"
      ? {
          field: "due_date",
          value: todayAsDateString(),
          today: true,
        }
      : {
          field: asAttribute(field),
          value: value
            ? canonicalName(decodeURIComponent(value))
            : "",
          today: false,
        };
  const archived =
    scope.field === "archived" && scope.value === "true";
  const finished =
    scope.field === "state" && scope.value === "complete";

  const [searchText, setSearchText] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [helping, setHelping] = useState(false);
  const [view, changeView] = useViewPreference(
    searchText === null ? viewKeyFor(scope) : SEARCH_VIEW_KEY,
    searchText === null ? defaultView(scope) : SEARCH_VIEW,
  );
  const actions = useTaskActions(changeView);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    setCapturing(false);
    setSearchText(null);
  }, [pathname]);

  const { data: lists = [] } = useQuery({
    queryKey: ["lists"],
    queryFn: api.lists,
  });

  const { tasks: everything, isPending } = useTasks();

  const tasks = useMemo(
    () => everything.filter((task) => within(task, scope)),
    [everything, scope.field, scope.value, scope.today],
  );

  const results = useMemo(
    () =>
      searchTasks({
        tasks: everything,
        input: searchText ?? "",
        today: new Date(),
      }),
    [everything, searchText],
  );

  useKeyboardShortcuts((event) => {
    if (event.key === "F" && searchText !== null) {
      event.preventDefault();
      setSearchText(null);
      return;
    }
    if (event.key === "n" && !archived && !finished) {
      event.preventDefault();
      setCapturing(true);
    }
    if (event.key === "f") {
      event.preventDefault();
      if (searchText === null) {
        setSearchText("");
        return;
      }
      document
        .querySelector<HTMLInputElement>("[data-search-field]")
        ?.focus();
    }
    if (event.key === "?") {
      event.preventDefault();
      setHelping(true);
    }
  });

  const captureSeed =
    searchText !== null || archived || finished
      ? null
      : scope.field && scope.field !== view.groupBy
        ? seedFor(scope)
        : {};

  return (
    <>
      <TopBar
        title={searchText === null ? titleFor(scope) : "Search"}
        view={view}
        onViewChange={changeView}
        searching={searchText !== null}
        finished={finished}
        onOpenSearch={() => setSearchText("")}
      />

      {searchText !== null && (
        <SearchField
          text={searchText}
          onChange={setSearchText}
          onClose={() => setSearchText(null)}
        />
      )}

      <TaskBoard
        key={pathname}
        tasks={searchText === null ? tasks : results}
        justToggled={actions.justToggled}
        view={view}
        lists={lists}
        hiddenAttributes={searchText === null ? scopedTo(scope) : []}
        showFinished={finished || searchText !== null}
        pending={searchText === null && isPending}
        emptyMessage={emptyMessageFor({
          searchText: searchText,
          scope: scope,
        })}
        captureSeed={captureSeed}
        capturing={capturing}
        onCapturingChange={setCapturing}
        actions={{
          toggle: actions.toggleTask,
          open: (task) =>
            navigate(`/${[...screen, task.id].join("/")}`),
          rename: actions.rename,
          create: actions.create,
          remove: actions.remove,
          swipeLeft: actions.swipeLeft,
          swipeRight: actions.swipeRight,
          undo: actions.undo,
          redo: actions.redo,
        }}
        onMove={actions.move}
      />

      {!archived && !finished && searchText === null && (
        <AddButton onClick={() => setCapturing(true)} />
      )}

      {openTaskId !== null && (
        <TaskInfo
          taskId={openTaskId}
          onClose={() => navigate(pathname)}
        />
      )}

      {helping && <Shortcuts onClose={() => setHelping(false)} />}
    </>
  );
}

function emptyMessageFor({
  searchText,
  scope,
}: {
  searchText: string | null;
  scope: Scope;
}): string {
  if (searchText === null) {
    return emptyFor(scope);
  }
  return searchText.trim().length > 0 ? "No matches." : "";
}

function within(task: CreatedTask, scope: Scope): boolean {
  if (scope.today) {
    return (
      task.archivedAt === null &&
      task.state !== "missed" &&
      dueOnOrBefore(task.dueDate, todayAsDateString())
    );
  }
  if (scope.field === "archived") {
    return (task.archivedAt !== null) === (scope.value === "true");
  }
  if (task.archivedAt !== null) {
    return false;
  }
  if (scope.field === null) {
    return notLongResolved(task);
  }
  if (scope.field === "state") {
    return task.state === scope.value;
  }
  return notLongResolved(task) && matches(task, scope);
}

function matches(task: CreatedTask, scope: Scope): boolean {
  if (scope.field === "list") {
    return canonicalName(task.list) === scope.value;
  }
  if (scope.field === "tag") {
    return task.tags.some(
      (tag) => canonicalName(tag) === scope.value,
    );
  }
  if (scope.field === "who") {
    return (
      task.who !== null && canonicalName(task.who) === scope.value
    );
  }
  if (scope.field === "stage") {
    return task.stage === scope.value;
  }
  if (scope.field === "due_date") {
    return task.dueDate === scope.value;
  }
  if (scope.field === "due_time") {
    return task.dueTime === scope.value;
  }
  if (scope.field === "recurring") {
    return (
      (task.recurringTaskId !== null) === (scope.value === "true")
    );
  }
  return true;
}

function notLongResolved(task: CreatedTask): boolean {
  if (task.state !== "complete" && task.state !== "skipped") {
    return true;
  }
  return (
    task.resolvedAt !== null &&
    task.resolvedAt.slice(0, 10) === todayAsDateString()
  );
}

function dueOnOrBefore(
  dueDate: string | null,
  today: string,
): boolean {
  return dueDate !== null && dueDate <= today;
}

function viewKeyFor(scope: Scope): string {
  if (scope.today) {
    return "today";
  }
  if (scope.field === "due_date") {
    return "due_date";
  }
  return scope.field ? `${scope.field}:${scope.value}` : "all";
}

function titleFor(scope: Scope): string {
  if (scope.today) {
    return "Today";
  }
  if (!scope.field) {
    return "To Do";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Done";
  }
  if (scope.field === "due_date") {
    return scope.value;
  }
  const text = attributeText(scope.field, scope.value);
  if (scope.field === "tag") {
    return `#${text}`;
  }
  if (scope.field === "who") {
    return `@${text}`;
  }
  return asTitle(text);
}

function scopedTo(scope: Scope): HiddenAttribute[] {
  return scope.field
    ? [
        {
          field: scope.field,
          label: attributeText(scope.field, scope.value),
        },
      ]
    : [];
}

function seedFor(scope: Scope): Partial<CreatedTask> {
  if (scope.field === "list") {
    return { list: scope.value };
  }
  if (scope.field === "tag") {
    return { tags: [scope.value] };
  }
  if (scope.field === "who") {
    return { who: scope.value };
  }
  if (scope.field === "stage") {
    return { stage: asStage(scope.value) };
  }
  if (scope.field === "due_date") {
    return { dueDate: scope.value };
  }
  return {};
}

function emptyFor(scope: Scope): string {
  if (scope.today) {
    return "Nothing today.";
  }
  if (scope.field === "archived" && scope.value === "true") {
    return "Nothing archived.";
  }
  if (scope.field === "state" && scope.value === "complete") {
    return "Nothing finished yet.";
  }
  return "Nothing here.";
}

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
  | "deleted"
  | "unhidden"
  | "deferred"
  | "hidden";

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
  destinationAttributes: DestinationAttributes;
  orderedIds: number[];
}

function without(
  tasks: CreatedTask[],
  ids: number[],
): CreatedTask[] {
  return tasks
    .filter((task) => !ids.includes(task.id))
    .map((task) =>
      task.subtasks
        ? { ...task, subtasks: without(task.subtasks, ids) }
        : task,
    );
}

function holdsTask(tasks: CreatedTask[], taskId: number): boolean {
  return tasks.some(
    (task) =>
      task.id === taskId || holdsTask(task.subtasks ?? [], taskId),
  );
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

function useTaskActions(
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
    queryClient.setQueriesData({ queryKey: [TASKS_KEY] }, (cached: unknown) =>
      looksLikeTasks(cached)
        ? patched({ tasks: cached, id: id, changes: changes })
        : cached,
    );
  }

  function takeBack(ids: number[]): void {
    queryClient.setQueriesData({ queryKey: [TASKS_KEY] }, (cached: unknown) =>
      looksLikeTasks(cached) ? without(cached, ids) : cached,
    );
  }

  function addToLedger(task: CreatedTask): void {
    queryClient.setQueriesData(
      { queryKey: [TASKS_KEY] },
      (cached: unknown) => {
        if (!looksLikeTasks(cached) || holdsTask(cached, task.id)) {
          return cached;
        }
        if (task.parentId === null) {
          return [...cached, task];
        }
        return cached.map((held) =>
          held.id === task.parentId
            ? { ...held, subtasks: [...(held.subtasks ?? []), task] }
            : held,
        );
      },
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
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
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
      { queryKey: [TASKS_KEY] },
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
      for (const { taskId, destinationAttributes, orderedIds } of queued) {
        if (destinationAttributes.stage !== undefined) {
          landed([
            await api.setState(
              taskId,
              destinationAttributes.stage === "complete" ? "complete" : "to_do",
            ),
          ]);
        }
        if (Object.keys(destinationAttributes).length > 0) {
          landed([await api.updateTask(taskId, destinationAttributes)]);
        }
        if (orderedIds.length > 1) {
          landed(await api.reorderTasks(orderedIds));
        }
      }
    })().catch(report("move that task"));
  }

  function move(
    taskId: number,
    destinationAttributes: DestinationAttributes,
    orderedIds: number[],
  ): void {
    if (Object.keys(destinationAttributes).length > 0) {
      patchEverywhere(taskId, {
        ...destinationAttributes,
        ...(destinationAttributes.stage === "complete"
          ? { state: "complete" as TaskState }
          : {}),
      });
    }
    reorderInMemory(orderedIds);

    pendingMoves.current.push({
      taskId: taskId,
      destinationAttributes: destinationAttributes,
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
      destinationAttributes: DestinationAttributes,
      orderedIds: number[],
    ) => {
      onManualOrder?.({ orderBy: "manual", orderDirection: "asc" });
      move(taskId, destinationAttributes, orderedIds);
    },
  };
}
